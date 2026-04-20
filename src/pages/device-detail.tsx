import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { 
  useGetDevice, 
  useUpdateDevice, 
  useDeleteDevice, 
  useListTelemetry, 
  useGetLatestTelemetry,
  getGetDeviceQueryKey,
  getGetLatestTelemetryQueryKey,
  getListTelemetryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, Key, Clock, Settings2, Trash2, Save, Wifi, WifiOff, Copy, CheckCircle2, Terminal, Link2, RefreshCw, ShieldCheck, Infinity, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const updateDeviceSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  type: z.string().min(2, "Type must be at least 2 characters").optional(),
  status: z.enum(["online", "offline", "inactive"]).optional(),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
});

type UpdateDeviceValues = z.infer<typeof updateDeviceSchema>;

export default function DeviceDetail() {
  const [, params] = useRoute("/devices/:id");
  const deviceId = params?.id ? parseInt(params.id) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  const { data: device, isLoading: deviceLoading } = useGetDevice(deviceId, {
    query: { enabled: !!deviceId, queryKey: getGetDeviceQueryKey(deviceId) }
  });

  const { data: latestTelemetry, isLoading: latestLoading } = useGetLatestTelemetry(
    { deviceId },
    { query: { enabled: !!deviceId, queryKey: getGetLatestTelemetryQueryKey({ deviceId }) } }
  );

  const { data: telemetryHistory, isLoading: historyLoading } = useListTelemetry(
    { deviceId, limit: 100 },
    { query: { enabled: !!deviceId, queryKey: getListTelemetryQueryKey({ deviceId, limit: 100 }) } }
  );

  const updateDevice = useUpdateDevice();
  const deleteDevice = useDeleteDevice();

  const form = useForm<UpdateDeviceValues>({
    resolver: zodResolver(updateDeviceSchema),
    values: device ? {
      name: device.name,
      type: device.type,
      status: device.status as any,
      description: device.description,
      location: device.location,
    } : undefined
  });

  const handleUpdate = (values: UpdateDeviceValues) => {
    updateDevice.mutate({ id: deviceId, data: values }, {
      onSuccess: () => {
        toast({ title: "Device updated successfully" });
        queryClient.invalidateQueries({ queryKey: getGetDeviceQueryKey(deviceId) });
      },
      onError: (err) => {
        toast({ title: "Update failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleDelete = () => {
    deleteDevice.mutate({ id: deviceId }, {
      onSuccess: () => {
        toast({ title: "Device deleted" });
        setLocation("/devices");
      },
      onError: (err) => {
        toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleRegenerateToken = async () => {
    setRegenerating(true);
    setShowRegenerateConfirm(false);
    try {
      const res = await fetch(`/api/devices/${deviceId}/regenerate-token`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      await queryClient.invalidateQueries({ queryKey: getGetDeviceQueryKey(deviceId) });
      toast({
        title: "Token regenerated",
        description: "Old token is no longer valid. Update your device firmware.",
      });
    } catch (err: any) {
      toast({ title: "Failed to regenerate token", description: err.message, variant: "destructive" });
    } finally {
      setRegenerating(false);
    }
  };

  const copyToken = () => {
    if (device?.accessToken) {
      navigator.clipboard.writeText(device.accessToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Token copied to clipboard" });
    }
  };

  if (deviceLoading) {
    return <PageContainer title="Loading..."><div className="h-64 animate-pulse bg-muted rounded-lg"></div></PageContainer>;
  }

  if (!device) {
    return <PageContainer title="Device Not Found"><p>This device doesn't exist.</p></PageContainer>;
  }

  // Prepare chart data - group by key
  const chartDataByKey: Record<string, any[]> = {};
  if (telemetryHistory) {
    // Filter to only numeric values and sort chronologically
    const numericHistory = [...telemetryHistory]
      .filter(t => t.numericValue !== null && t.numericValue !== undefined)
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

    numericHistory.forEach(t => {
      if (!chartDataByKey[t.key]) chartDataByKey[t.key] = [];
      chartDataByKey[t.key].push({
        time: new Date(t.recordedAt).getTime(),
        value: t.numericValue
      });
    });
  }

  return (
    <PageContainer 
      title={device.name} 
      description={`ID: ${device.id} · ${device.type}`}
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLocation("/devices")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the device "{device.name}" and all of its telemetry data and associated alerts.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Device Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current State</span>
              <Badge variant={
                device.status === 'online' ? "default" :
                device.status === 'offline' ? "destructive" : "secondary"
              } className={device.status === 'online' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                {device.status === 'online' && <Wifi className="h-3 w-3 mr-1" />}
                {device.status === 'offline' && <WifiOff className="h-3 w-3 mr-1" />}
                {device.status}
              </Badge>
            </div>
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Access Token</span>
              <div className="flex items-center mt-1">
                <code className="flex-1 bg-muted p-2 rounded-l-md text-xs font-mono truncate">
                  {device.accessToken}
                </code>
                <Button variant="secondary" className="rounded-l-none px-3" onClick={copyToken}>
                  {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Use this token to authenticate API requests from this device.</p>
            </div>
            
            <div className="pt-4 border-t border-border grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center"><Clock className="h-3 w-3 mr-1"/> Created</p>
                <p className="text-sm">{format(new Date(device.createdAt), 'MMM d, yyyy')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Last Updated</p>
                <p className="text-sm">{format(new Date(device.updatedAt), 'MMM d, yyyy')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Latest Readings</CardTitle>
            <CardDescription>Most recent telemetry received from this device</CardDescription>
          </CardHeader>
          <CardContent>
            {latestLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />)}
              </div>
            ) : latestTelemetry && latestTelemetry.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {latestTelemetry.map(t => (
                  <div key={t.key} className="border border-border rounded-lg p-4 bg-card">
                    <div className="text-xs text-muted-foreground font-mono mb-1">{t.key}</div>
                    <div className="text-2xl font-bold text-primary truncate" title={t.value}>{t.value}</div>
                    <div className="text-xs text-muted-foreground mt-2 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {format(new Date(t.recordedAt), 'HH:mm:ss')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center border border-dashed rounded-lg text-muted-foreground">
                No telemetry data has been received from this device yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="charts" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="history">Data History</TabsTrigger>
          <TabsTrigger value="connect"><Link2 className="h-3.5 w-3.5 mr-1.5" />Connect Device</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="charts" className="space-y-6">
          {Object.keys(chartDataByKey).length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Object.entries(chartDataByKey).map(([key, data]) => (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle className="text-base font-mono">{key}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <defs>
                            <linearGradient id={`color-${key}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis 
                            dataKey="time" 
                            type="number"
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={(unixTime) => format(new Date(unixTime), 'HH:mm')}
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                          />
                          <YAxis 
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                            domain={['auto', 'auto']}
                          />
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                            labelFormatter={(label) => format(new Date(label), 'MMM d, HH:mm:ss')}
                          />
                          <Area type="step" dataKey="value" stroke="hsl(var(--primary))" fillOpacity={1} fill={`url(#color-${key})`} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No numeric telemetry data available for charting.
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Recent Telemetry History</CardTitle>
              <CardDescription>Last 100 readings received</CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="h-64 animate-pulse bg-muted rounded-lg"></div>
              ) : telemetryHistory && telemetryHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 font-medium rounded-tl-lg">Key</th>
                        <th className="px-4 py-3 font-medium">Value</th>
                        <th className="px-4 py-3 font-medium">Numeric Value</th>
                        <th className="px-4 py-3 font-medium rounded-tr-lg">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {telemetryHistory.map((reading) => (
                        <tr key={reading.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 font-mono text-xs">{reading.key}</td>
                          <td className="px-4 py-3">
                            <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-mono">
                              {reading.value}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {reading.numericValue !== null ? reading.numericValue : '—'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {format(new Date(reading.recordedAt), 'MMM d, HH:mm:ss')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No telemetry history available.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="connect" className="space-y-6">
          {/* Security badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-3 p-3 border border-green-500/30 bg-green-500/5 rounded-lg">
              <ShieldCheck className="h-5 w-5 text-green-500 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-green-500">Bearer Token Auth</p>
                <p className="text-xs text-muted-foreground">Mỗi thiết bị một token riêng</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 border border-primary/30 bg-primary/5 rounded-lg">
              <Infinity className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-xs font-semibold text-primary">Không giới hạn dữ liệu</p>
                <p className="text-xs text-muted-foreground">Gửi liên tục, không bị chặn</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 border border-orange-500/30 bg-orange-500/5 rounded-lg">
              <ShieldCheck className="h-5 w-5 text-orange-500 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-orange-500">Rate limit: 300 req/phút</p>
                <p className="text-xs text-muted-foreground">Chống spam, bảo vệ server</p>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Terminal className="h-5 w-5 text-primary" />Hướng dẫn kết nối thiết bị</CardTitle>
              <CardDescription>Gửi dữ liệu telemetry từ thiết bị IoT qua HTTP POST với Bearer token.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 border border-primary/30 bg-primary/5 rounded-lg">
                <p className="text-sm font-medium text-primary mb-1">Endpoint URL</p>
                <code className="text-sm font-mono break-all">{window.location.origin}/api/v1/connect</code>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">Bước 1 — Sao chép access token</p>
                  <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                        <RefreshCw className="h-3 w-3" />
                        Tạo token mới
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-orange-500" />
                          Tạo lại Access Token?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Token cũ sẽ bị vô hiệu hoá ngay lập tức. Bạn cần cập nhật firmware trên thiết bị thực với token mới, nếu không thiết bị sẽ mất kết nối.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRegenerateToken} className="bg-orange-500 hover:bg-orange-600">
                          {regenerating ? "Đang tạo..." : "Tạo token mới"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="flex items-center">
                  <code className="flex-1 bg-muted p-3 rounded-l-md text-xs font-mono truncate">{device.accessToken}</code>
                  <button onClick={copyToken} className="px-3 py-3 bg-secondary border border-border rounded-r-md hover:bg-accent transition-colors">
                    {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">Giữ token này bí mật. Nếu bị lộ, hãy tạo token mới ngay.</p>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Step 2 — Send telemetry via HTTP</p>
                <p className="text-xs text-muted-foreground mb-2">Send a POST request with a JSON body where keys are metric names and values are numbers or strings:</p>
                <pre className="bg-muted/70 p-4 rounded-lg text-xs font-mono overflow-x-auto border border-border">{`# Using curl (Linux / macOS / Terminal)
curl -X POST "${window.location.origin}/api/v1/connect" \\
  -H "Authorization: Bearer ${device.accessToken}" \\
  -H "Content-Type: application/json" \\
  -d '{"temperature": 25.3, "humidity": 60, "pressure": 1013}'`}</pre>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Bước 3 — Python (Raspberry Pi / ESP32)</p>
                <pre className="bg-muted/70 p-4 rounded-lg text-xs font-mono overflow-x-auto border border-border">{`import requests

TOKEN = "${device.accessToken}"
URL = "${window.location.origin}/api/v1/connect"

def send_telemetry(data: dict):
    response = requests.post(
        URL,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json"
        },
        json=data
    )
    return response.json()

# Example: send sensor readings
send_telemetry({
    "temperature": 25.3,
    "humidity": 60,
    "pressure": 1013,
    "status": "ok"
})`}</pre>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Bước 4 — Arduino / ESP8266 (HTTP)</p>
                <pre className="bg-muted/70 p-4 rounded-lg text-xs font-mono overflow-x-auto border border-border">{`#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>

String token = "${device.accessToken}";
String url = "${window.location.origin}/api/v1/connect";

void sendTelemetry(float temp, float humidity) {
  WiFiClient client;
  HTTPClient http;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + token);
  String body = "{\\"temperature\\":" + String(temp) +
                ",\\"humidity\\":" + String(humidity) + "}";
  int code = http.POST(body);
  http.end();
}`}</pre>
              </div>

              <div className="p-4 border border-border rounded-lg bg-card space-y-2">
                <p className="text-sm font-semibold">Phản hồi từ server</p>
                <pre className="text-xs font-mono text-muted-foreground">{`{
  "deviceId": ${device.id},
  "deviceName": "${device.name}",
  "recorded": 3,
  "keys": ["temperature", "humidity", "pressure"],
  "timestamp": "2026-01-01T00:00:00.000Z"
}`}</pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Device Settings</CardTitle>
              <CardDescription>Update device metadata and status</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4 max-w-2xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Device Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-edit-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Device Type</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-edit-type" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="online">Online</SelectItem>
                              <SelectItem value="offline">Offline</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ''} data-testid="input-edit-location" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} data-testid="input-edit-desc" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="pt-4">
                    <Button type="submit" disabled={updateDevice.isPending} data-testid="btn-save-device">
                      <Save className="h-4 w-4 mr-2" />
                      {updateDevice.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

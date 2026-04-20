import { useState } from "react";
import { 
  useListAlerts, 
  useCreateAlert, 
  useDeleteAlert, 
  useListTriggeredAlerts,
  getListAlertsQueryKey,
  useListDevices
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, AlertTriangle, BellRing, Trash2, Clock } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const createAlertSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  deviceId: z.coerce.number().positive("Device is required"),
  telemetryKey: z.string().min(1, "Telemetry key is required"),
  condition: z.enum(["gt", "lt", "eq", "gte", "lte"]),
  threshold: z.coerce.number(),
  severity: z.enum(["info", "warning", "critical"]),
});

type CreateAlertValues = z.infer<typeof createAlertSchema>;

const getConditionLabel = (condition: string) => {
  switch (condition) {
    case 'gt': return '>';
    case 'lt': return '<';
    case 'eq': return '=';
    case 'gte': return '>=';
    case 'lte': return '<=';
    default: return condition;
  }
};

const SeverityBadge = ({ severity }: { severity: string }) => {
  if (severity === 'critical') {
    return <Badge className="bg-destructive hover:bg-destructive text-destructive-foreground">Critical</Badge>;
  }
  if (severity === 'warning') {
    return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Warning</Badge>;
  }
  return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Info</Badge>;
};

export default function Alerts() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: alerts, isLoading: alertsLoading } = useListAlerts();
  const { data: triggeredAlerts, isLoading: triggeredLoading } = useListTriggeredAlerts({ limit: 50 });
  const { data: devices } = useListDevices();

  const createAlert = useCreateAlert();
  const deleteAlert = useDeleteAlert();

  const form = useForm<CreateAlertValues>({
    resolver: zodResolver(createAlertSchema),
    defaultValues: {
      name: "",
      deviceId: 0,
      telemetryKey: "",
      condition: "gt",
      threshold: 0,
      severity: "warning",
    },
  });

  const onSubmit = (values: CreateAlertValues) => {
    createAlert.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Alert rule created" });
        setIsCreateOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Failed to create rule", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteAlert.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Alert rule deleted" });
        queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <PageContainer 
      title="Alerts & Rules" 
      description="Configure telemetry thresholds and view triggered events"
      action={
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="btn-create-alert">
              <Plus className="h-4 w-4 mr-2" /> New Alert Rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Alert Rule</DialogTitle>
              <DialogDescription>Define a condition that will trigger an alert.</DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rule Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. High Temperature" {...field} data-testid="input-alert-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="deviceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Device</FormLabel>
                      <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value ? field.value.toString() : undefined}>
                        <FormControl>
                          <SelectTrigger data-testid="select-alert-device">
                            <SelectValue placeholder="Select a device" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {devices?.map(d => (
                            <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="telemetryKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telemetry Key</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. temp" {...field} data-testid="input-alert-key" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Severity</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-alert-severity">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="info">Info</SelectItem>
                            <SelectItem value="warning">Warning</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condition</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-alert-condition">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="gt">Greater than (&gt;)</SelectItem>
                            <SelectItem value="lt">Less than (&lt;)</SelectItem>
                            <SelectItem value="eq">Equals (=)</SelectItem>
                            <SelectItem value="gte">Greater/Eq (&gt;=)</SelectItem>
                            <SelectItem value="lte">Less/Eq (&lt;=)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="threshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Threshold Value</FormLabel>
                        <FormControl>
                          <Input type="number" step="any" {...field} data-testid="input-alert-threshold" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={createAlert.isPending} data-testid="btn-submit-alert">
                    {createAlert.isPending ? "Creating..." : "Create Rule"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      }
    >
      <Tabs defaultValue="rules" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="rules" className="gap-2"><BellRing className="h-4 w-4"/> Alert Rules</TabsTrigger>
          <TabsTrigger value="triggered" className="gap-2"><AlertTriangle className="h-4 w-4"/> Triggered Events</TabsTrigger>
        </TabsList>
        
        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Configured Rules</CardTitle>
              <CardDescription>Rules that are actively monitoring incoming telemetry</CardDescription>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />)}
                </div>
              ) : alerts && alerts.length > 0 ? (
                <div className="grid gap-4">
                  {alerts.map(alert => (
                    <div key={alert.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-card">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="font-semibold">{alert.name}</h4>
                          <SeverityBadge severity={alert.severity} />
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <span className="font-medium text-foreground">{alert.deviceName}</span>
                          <span>·</span>
                          <span className="font-mono bg-muted px-1.5 rounded text-xs">{alert.telemetryKey}</span>
                          <span className="font-mono text-primary">{getConditionLabel(alert.condition)}</span>
                          <span className="font-mono bg-muted px-1.5 rounded text-xs">{alert.threshold}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(alert.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center border border-dashed rounded-lg bg-card/50">
                  <BellRing className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-medium">No alert rules</h3>
                  <p className="text-sm text-muted-foreground mt-1">Create an alert rule to monitor your devices.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="triggered">
          <Card>
            <CardHeader>
              <CardTitle>Triggered History</CardTitle>
              <CardDescription>Recent alert events from all devices</CardDescription>
            </CardHeader>
            <CardContent>
              {triggeredLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />)}
                </div>
              ) : triggeredAlerts && triggeredAlerts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 font-medium rounded-tl-lg">Time</th>
                        <th className="px-4 py-3 font-medium">Severity</th>
                        <th className="px-4 py-3 font-medium">Rule Name</th>
                        <th className="px-4 py-3 font-medium">Device</th>
                        <th className="px-4 py-3 font-medium rounded-tr-lg">Trigger Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {triggeredAlerts.map((event) => (
                        <tr key={event.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {format(new Date(event.triggeredAt), 'MMM d, HH:mm:ss')}
                          </td>
                          <td className="px-4 py-3">
                            <SeverityBadge severity={event.severity} />
                          </td>
                          <td className="px-4 py-3 font-medium">{event.alertName}</td>
                          <td className="px-4 py-3">{event.deviceName}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-xs font-mono">
                              <span className="text-muted-foreground">{event.telemetryKey}</span>
                              <span className="text-primary">=</span>
                              <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                {event.value}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center border border-dashed rounded-lg bg-card/50">
                  <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-medium">No triggered alerts</h3>
                  <p className="text-sm text-muted-foreground mt-1">All your devices are operating within normal parameters.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

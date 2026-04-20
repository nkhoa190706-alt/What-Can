import { useState } from "react";
import { 
  useListTelemetry, 
  useIngestTelemetry,
  useListDevices,
  getListTelemetryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Database, Filter, Plus, Search, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const ingestSchema = z.object({
  deviceId: z.coerce.number().positive("Device is required"),
  key: z.string().min(1, "Key is required"),
  value: z.string().min(1, "Value is required"),
});

type IngestValues = z.infer<typeof ingestSchema>;

export default function Telemetry() {
  const [selectedDevice, setSelectedDevice] = useState<string>("all");
  const [searchKey, setSearchKey] = useState("");
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: devices } = useListDevices();
  
  // Prepare params based on filters
  const queryParams: any = { limit: 100 };
  if (selectedDevice !== "all") queryParams.deviceId = parseInt(selectedDevice);
  if (searchKey) queryParams.key = searchKey;

  const { data: telemetry, isLoading, refetch, isRefetching } = useListTelemetry(queryParams);
  const ingestTelemetry = useIngestTelemetry();

  const form = useForm<IngestValues>({
    resolver: zodResolver(ingestSchema),
    defaultValues: {
      deviceId: 0,
      key: "",
      value: "",
    },
  });

  const onSubmit = (values: IngestValues) => {
    // Attempt to parse as number for numericValue
    const numericValue = !isNaN(Number(values.value)) ? Number(values.value) : undefined;
    
    ingestTelemetry.mutate({ 
      data: {
        ...values,
        numericValue
      }
    }, {
      onSuccess: () => {
        toast({ title: "Data ingested successfully" });
        setIsIngestOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListTelemetryQueryKey(queryParams) });
      },
      onError: (err) => {
        toast({ title: "Failed to ingest data", description: err.message, variant: "destructive" });
      }
    });
  };

  // Helper to map device ID to name
  const getDeviceName = (id: number) => {
    return devices?.find(d => d.id === id)?.name || `Unknown (${id})`;
  };

  return (
    <PageContainer 
      title="Telemetry Explorer" 
      description="View raw data streams from all devices"
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Dialog open={isIngestOpen} onOpenChange={setIsIngestOpen}>
            <DialogTrigger asChild>
              <Button data-testid="btn-ingest">
                <Plus className="h-4 w-4 mr-2" /> Ingest Data
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manual Data Ingestion</DialogTitle>
                <DialogDescription>Simulate incoming telemetry data for testing.</DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="deviceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Device</FormLabel>
                        <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value ? field.value.toString() : undefined}>
                          <FormControl>
                            <SelectTrigger data-testid="select-ingest-device">
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
                      name="key"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Key</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. temp" {...field} data-testid="input-ingest-key" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Value</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 25.4" {...field} data-testid="input-ingest-value" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <DialogFooter className="pt-4">
                    <Button type="submit" disabled={ingestTelemetry.isPending} data-testid="btn-submit-ingest">
                      {ingestTelemetry.isPending ? "Sending..." : "Send Data"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <Card className="mb-6">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground w-full sm:w-auto shrink-0">
            <Filter className="h-4 w-4" /> Filters
          </div>
          
          <Select value={selectedDevice} onValueChange={setSelectedDevice}>
            <SelectTrigger className="w-full sm:w-[250px]" data-testid="filter-device">
              <SelectValue placeholder="Filter by device" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Devices</SelectItem>
              {devices?.map(d => (
                <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative w-full sm:w-[250px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Filter by key (e.g. temp)" 
              className="pl-9"
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              data-testid="filter-key"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded-md" />)}
            </div>
          ) : telemetry && telemetry.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-medium">Device</th>
                    <th className="px-6 py-4 font-medium">Key</th>
                    <th className="px-6 py-4 font-medium">Value</th>
                    <th className="px-6 py-4 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {telemetry.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3 font-medium">{getDeviceName(t.deviceId)}</td>
                      <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{t.key}</td>
                      <td className="px-6 py-3">
                        <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-mono">
                          {t.value}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                        {format(new Date(t.recordedAt), 'yyyy-MM-dd HH:mm:ss.SSS')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center">
              <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-30" />
              <h3 className="text-lg font-medium">No telemetry data</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                No readings match your current filters, or no data has been ingested yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

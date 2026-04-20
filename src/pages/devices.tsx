import { useState } from "react";
import { Link } from "wouter";
import { useListDevices, useCreateDevice, getListDevicesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Search, MonitorSmartphone, Wifi, WifiOff, Settings } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const createDeviceSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  type: z.string().min(2, "Type must be at least 2 characters"),
  description: z.string().optional(),
  location: z.string().optional(),
});

type CreateDeviceValues = z.infer<typeof createDeviceSchema>;

export default function Devices() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: devices, isLoading } = useListDevices(
    statusFilter !== "all" ? { status: statusFilter as any } : undefined
  );
  
  const createDevice = useCreateDevice();

  const form = useForm<CreateDeviceValues>({
    resolver: zodResolver(createDeviceSchema),
    defaultValues: {
      name: "",
      type: "",
      description: "",
      location: "",
    },
  });

  const onSubmit = (values: CreateDeviceValues) => {
    createDevice.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Device created", description: `${values.name} has been added.` });
        setIsCreateOpen(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
      },
      onError: (error: any) => {
        toast({ title: "Failed to create device", description: error.message, variant: "destructive" });
      }
    });
  };

  const filteredDevices = devices?.filter(device => 
    device.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    device.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (device.location && device.location.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  return (
    <PageContainer 
      title="Devices" 
      description="Manage and monitor your connected devices"
      action={
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="btn-create-device">
              <Plus className="h-4 w-4 mr-2" /> Add Device
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Device</DialogTitle>
              <DialogDescription>Register a new IoT device on the platform.</DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Device Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Sensor Alpha" {...field} data-testid="input-device-name" />
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
                        <Input placeholder="e.g. Temperature Sensor" {...field} data-testid="input-device-type" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Server Room A" {...field} data-testid="input-device-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Brief description" {...field} data-testid="input-device-desc" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={createDevice.isPending} data-testid="btn-submit-device">
                    {createDevice.isPending ? "Creating..." : "Create Device"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search devices by name, type, or location..." 
            className="pl-9 bg-card"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-devices"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-card" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-40 bg-muted/20"></CardContent>
            </Card>
          ))
        ) : filteredDevices.length > 0 ? (
          filteredDevices.map((device) => (
            <Link key={device.id} href={`/devices/${device.id}`}>
              <Card className="cursor-pointer hover:border-primary/50 transition-colors group">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-md ${
                        device.status === 'online' ? 'bg-emerald-500/10 text-emerald-500' :
                        device.status === 'offline' ? 'bg-destructive/10 text-destructive' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {device.status === 'online' ? <Wifi className="h-5 w-5" /> : 
                         device.status === 'offline' ? <WifiOff className="h-5 w-5" /> :
                         <Settings className="h-5 w-5" />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors" data-testid={`text-devicename-${device.id}`}>{device.name}</h3>
                        <p className="text-xs text-muted-foreground">{device.type}</p>
                      </div>
                    </div>
                    <Badge variant={
                      device.status === 'online' ? "default" :
                      device.status === 'offline' ? "destructive" : "secondary"
                    } className={device.status === 'online' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                      {device.status}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-y-2 text-sm text-muted-foreground mt-4">
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-wider opacity-70">Location</span>
                      <span className="truncate">{device.location || '—'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-wider opacity-70">Created</span>
                      <span>{format(new Date(device.createdAt), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <div className="col-span-full py-12 text-center border border-dashed rounded-lg bg-card/50">
            <MonitorSmartphone className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No devices found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchTerm || statusFilter !== "all" 
                ? "Try adjusting your search or filters." 
                : "Add your first device to get started."}
            </p>
            {!(searchTerm || statusFilter !== "all") && (
              <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                Add Device
              </Button>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

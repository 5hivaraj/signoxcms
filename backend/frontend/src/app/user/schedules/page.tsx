'use client';

import { useEffect, useState } from 'react';
import { Plus, Calendar, Clock, Monitor, Play, Edit, Trash2, CalendarClock } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/lib/api';
import AOS from 'aos';
import 'aos/dist/aos.css';

interface Schedule {
  id: string;
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  timezone: string;
  repeatDays: string[];
  startDate?: string;
  endDate?: string;
  priority: number;
  isActive: boolean;
  orientation?: 'LANDSCAPE' | 'PORTRAIT';
  playlist?: {
    id: string;
    name: string;
    description?: string;
  };
  layout?: {
    id: string;
    name: string;
    description?: string;
  };
  displays: Array<{
    display: {
      id: string;
      name: string;
      status: string;
    };
  }>;
  createdAt: string;
}

interface Display {
  id: string;
  name: string;
  status: string;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
}

interface Layout {
  id: string;
  name: string;
  description?: string;
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [displays, setDisplays] = useState<Display[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form state (timezone defaults to Asia/Kolkata to match player schedule check)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startTime: '',
    endTime: '',
    timezone: 'Asia/Kolkata',
    repeatDays: [] as string[],
    startDate: '',
    endDate: '',
    priority: 1,
    contentType: 'playlist' as 'playlist' | 'layout',
    playlistId: '',
    layoutId: '',
    displayIds: [] as string[],
    orientation: 'LANDSCAPE' as 'LANDSCAPE' | 'PORTRAIT',
  });

  const daysOfWeek = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' }
  ];

  useEffect(() => {
    // Initialize AOS
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic',
    });
    
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [schedulesRes, displaysRes, playlistsRes, layoutsRes] = await Promise.all([
        api.get('/schedules'),
        api.get('/displays'),
        api.get('/playlists'),
        api.get('/layouts')
      ]);

      setSchedules(schedulesRes.data.schedules || []);
      setDisplays(displaysRes.data.displays || []);
      setPlaylists(playlistsRes.data.playlists || []);
      setLayouts(layoutsRes.data.layouts || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validate before submit
    if (!formData.name?.trim()) {
      setFormError('Schedule name is required.');
      return;
    }
    if (!formData.startTime || !formData.endTime) {
      setFormError('Start time and end time are required.');
      return;
    }
    if (!formData.repeatDays?.length) {
      setFormError('Select at least one repeat day.');
      return;
    }
    if (formData.contentType === 'playlist' && !formData.playlistId?.trim()) {
      setFormError('Select a playlist.');
      return;
    }
    if (formData.contentType === 'layout' && !formData.layoutId?.trim()) {
      setFormError('Select a layout.');
      return;
    }
    if (!formData.displayIds?.length) {
      setFormError('Select at least one display to assign this schedule to.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        startTime: formData.startTime,
        endTime: formData.endTime,
        timezone: formData.timezone,
        repeatDays: formData.repeatDays,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        priority: formData.priority,
        playlistId: formData.contentType === 'playlist' && formData.playlistId ? formData.playlistId : null,
        layoutId: formData.contentType === 'layout' && formData.layoutId ? formData.layoutId : null,
        displayIds: formData.displayIds,
        orientation: formData.orientation,
      };

      if (editingSchedule) {
        await api.put(`/schedules/${editingSchedule.id}`, payload);
      } else {
        await api.post('/schedules', payload);
      }

      await fetchData();
      resetForm();
      setShowCreateDialog(false);
      setEditingSchedule(null);
    } catch (error: any) {
      console.error('Failed to save schedule:', error);
      const msg = error?.response?.data?.message || error?.response?.data?.error || 'Failed to save schedule';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      await api.delete(`/schedules/${scheduleId}`);
      await fetchData();
    } catch (error: any) {
      console.error('Failed to delete schedule:', error);
      alert(error.response?.data?.message || 'Failed to delete schedule');
    }
  };

  const resetForm = () => {
    setFormError('');
    setFormData({
      name: '',
      description: '',
      startTime: '',
      endTime: '',
      timezone: 'Asia/Kolkata',
      repeatDays: [],
      startDate: '',
      endDate: '',
      priority: 1,
      contentType: 'playlist',
      playlistId: '',
      layoutId: '',
      displayIds: [],
      orientation: 'LANDSCAPE',
    });
  };

  const handleEdit = (schedule: Schedule) => {
    setFormData({
      name: schedule.name,
      description: schedule.description || '',
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      timezone: schedule.timezone,
      repeatDays: schedule.repeatDays,
      startDate: schedule.startDate ? schedule.startDate.split('T')[0] : '',
      endDate: schedule.endDate ? schedule.endDate.split('T')[0] : '',
      priority: schedule.priority,
      contentType: schedule.playlist ? 'playlist' : 'layout',
      playlistId: schedule.playlist?.id || '',
      layoutId: schedule.layout?.id || '',
      displayIds: schedule.displays.map(d => d.display.id),
      orientation: schedule.orientation || 'LANDSCAPE',
    });
    setEditingSchedule(schedule);
    setShowCreateDialog(true);
  };

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      repeatDays: prev.repeatDays.includes(day)
        ? prev.repeatDays.filter(d => d !== day)
        : [...prev.repeatDays, day]
    }));
  };

  const toggleDisplay = (displayId: string) => {
    setFormData(prev => ({
      ...prev,
      displayIds: prev.displayIds.includes(displayId)
        ? prev.displayIds.filter(id => id !== displayId)
        : [...prev.displayIds, displayId]
    }));
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDays = (days: string[]) => {
    const dayMap: { [key: string]: string } = {
      monday: 'Mon',
      tuesday: 'Tue',
      wednesday: 'Wed',
      thursday: 'Thu',
      friday: 'Fri',
      saturday: 'Sat',
      sunday: 'Sun'
    };
    return days.map(day => dayMap[day]).join(', ');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading schedules...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-8">
        {/* Header Section */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-orange-500/10 rounded-3xl blur-3xl"></div>
          <div className="relative bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 border border-gray-800 shadow-2xl">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <CalendarClock className="h-10 w-10 text-yellow-400" />
                  <h1 className="text-4xl font-black text-white">Schedules</h1>
                </div>
                <p className="text-gray-300 text-lg">Manage content scheduling for your displays</p>
              </div>
              <Dialog open={showCreateDialog} onOpenChange={(open) => { setShowCreateDialog(open); if (!open) setFormError(''); }}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm} className="h-12 gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black font-bold shadow-lg hover:shadow-yellow-500/50 transition-all duration-300 hover:scale-105">
                    <Plus className="h-5 w-5" />
                    Create Schedule
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
                  <DialogHeader>
                    <DialogTitle className="text-2xl">
                      {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
                    </DialogTitle>
                    <DialogDescription className="text-base">
                      Assign a playlist or layout to run on selected displays during the chosen time and days. The player will show this content when the schedule is active.
                    </DialogDescription>
                  </DialogHeader>
                  
                  {formError && (
                    <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800 border border-red-200">
                      <p className="font-semibold mb-1">Error</p>
                      <p>{formError}</p>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="name">Schedule Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Morning Playlist"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Input
                      id="priority"
                      type="number"
                      min="1"
                      max="10"
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="startTime">Start Time *</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="endTime">End Time *</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="timezone">Timezone</Label>
                    <select
                      id="timezone"
                      value={formData.timezone}
                      onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                      <option value="Asia/Kolkata">India Standard Time</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label>Repeat Days *</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {daysOfWeek.map(day => (
                      <Button
                        key={day.value}
                        type="button"
                        variant={formData.repeatDays.includes(day.value) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleDay(day.value)}
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="startDate">Start Date (Optional)</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date (Optional)</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>

                <Tabs value={formData.contentType} onValueChange={(value) => setFormData(prev => ({ ...prev, contentType: value as 'playlist' | 'layout' }))}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="playlist">Playlist</TabsTrigger>
                    <TabsTrigger value="layout">Layout</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="playlist" className="space-y-4">
                    <div>
                      <Label htmlFor="playlistId">Select Playlist *</Label>
                      <select
                        id="playlistId"
                        value={formData.playlistId}
                        onChange={(e) => setFormData(prev => ({ ...prev, playlistId: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md mt-1"
                        required={formData.contentType === 'playlist'}
                      >
                        <option value="">Choose a playlist...</option>
                        {playlists.map(playlist => (
                          <option key={playlist.id} value={playlist.id}>
                            {playlist.name}
                          </option>
                        ))}
                      </select>
                      {playlists.length === 0 && (
                        <p className="text-sm text-gray-500 mt-1">No playlists available. Create one first.</p>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="layout" className="space-y-4">
                    <div>
                      <Label htmlFor="layoutId">Select Layout *</Label>
                      <select
                        id="layoutId"
                        value={formData.layoutId}
                        onChange={(e) => setFormData(prev => ({ ...prev, layoutId: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md mt-1"
                        required={formData.contentType === 'layout'}
                      >
                        <option value="">Choose a layout...</option>
                        {layouts.map(layout => (
                          <option key={layout.id} value={layout.id}>
                            {layout.name}
                          </option>
                        ))}
                      </select>
                      {layouts.length === 0 && (
                        <p className="text-sm text-gray-500 mt-1">No layouts available. Create one first.</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="orientation">Display Orientation</Label>
                    <select
                      id="orientation"
                      value={formData.orientation}
                      onChange={(e) => setFormData(prev => ({ ...prev, orientation: e.target.value as 'LANDSCAPE' | 'PORTRAIT' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md mt-1"
                    >
                      <option value="LANDSCAPE">Landscape</option>
                      <option value="PORTRAIT">Portrait</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Preferred orientation for displays when this schedule is active.</p>
                  </div>
                  <div>
                    <Label className="block mb-2">Preview</Label>
                    <div
                      className={`border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 text-sm ${
                        formData.orientation === 'PORTRAIT' ? 'w-24 h-40 mx-auto' : 'w-40 h-24'
                      }`}
                      title="Resize preview"
                    >
                      {formData.orientation === 'PORTRAIT' ? 'Portrait' : 'Landscape'}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Aspect ratio preview for this schedule.</p>
                  </div>
                </div>

                <div>
                  <Label>Assign to displays *</Label>
                  <p className="text-xs text-gray-500 mt-1 mb-2">
                    Select which displays will show this schedule. Content plays only during the time range and days you set above.
                  </p>
                  <div className="mt-2 border border-gray-200 rounded-md">
                    <div className="max-h-48 overflow-y-auto p-3 space-y-3">
                      {displays.length === 0 ? (
                        <div className="text-sm text-gray-500 text-center py-4">
                          No displays available. Add and pair a display in <a href="/user/displays" className="text-blue-600 underline">Display Management</a> first, then create a schedule.
                        </div>
                      ) : (
                        displays.map(display => (
                          <div key={display.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-md">
                            <input
                              type="checkbox"
                              id={`display-${display.id}`}
                              checked={formData.displayIds.includes(display.id)}
                              onChange={() => toggleDisplay(display.id)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor={`display-${display.id}`} className="flex items-center space-x-2 flex-1 cursor-pointer">
                              <Monitor className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium">{display.name || 'Unnamed Display'}</span>
                              <Badge variant={display.status === 'ONLINE' ? 'default' : 'secondary'} className="ml-auto">
                                {display.status}
                              </Badge>
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                    {displays.length > 5 && (
                      <div className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-500 text-center">
                        Scroll to see more displays
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Saving…' : editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {schedules.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No schedules yet</h3>
                <p className="text-gray-500 text-center mb-4">
                  Create your first schedule to automatically play content on your displays
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Schedule
                </Button>
              </CardContent>
            </Card>
          ) : (
            schedules.map((schedule, index) => (
              <Card key={schedule.id} className="border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-2 rounded-lg">
                          <Calendar className="h-5 w-5 text-white" />
                        </div>
                        {schedule.name}
                        {!schedule.isActive && (
                          <Badge variant="secondary" className="text-sm">Inactive</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-base mt-2">{schedule.description}</CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(schedule)}
                        className="hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(schedule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <Clock className="h-4 w-4" />
                        Time
                      </div>
                      <div className="font-medium">
                        {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                      </div>
                      <div className="text-sm text-gray-500">{schedule.timezone}</div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Days</div>
                      <div className="font-medium">{formatDays(schedule.repeatDays)}</div>
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <Play className="h-4 w-4" />
                        Content
                      </div>
                      <div className="font-medium">
                        {schedule.playlist ? schedule.playlist.name : schedule.layout?.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {schedule.playlist ? 'Playlist' : 'Layout'}
                        {schedule.orientation && (
                          <span className="ml-1">• {schedule.orientation}</span>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <Monitor className="h-4 w-4" />
                        Displays ({schedule.displays.length})
                      </div>
                      <div className="space-y-1">
                        {schedule.displays.slice(0, 2).map(({ display }) => (
                          <div key={display.id} className="flex items-center gap-2">
                            <span className="text-sm font-medium">{display.name}</span>
                            <Badge variant={display.status === 'ONLINE' ? 'default' : 'secondary'} className="text-xs">
                              {display.status}
                            </Badge>
                          </div>
                        ))}
                        {schedule.displays.length > 2 && (
                          <div className="text-sm text-gray-500">
                            +{schedule.displays.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {(schedule.startDate || schedule.endDate) && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="text-sm text-gray-600">
                        Active: {schedule.startDate ? new Date(schedule.startDate).toLocaleDateString() : 'Always'} - {schedule.endDate ? new Date(schedule.endDate).toLocaleDateString() : 'Forever'}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
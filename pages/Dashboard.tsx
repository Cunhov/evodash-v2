import React, { useEffect, useState } from 'react';
import { EvoConfig } from '../types';
import { supabase } from '../services/supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, CheckCircle, AlertTriangle, Clock, Send, Users } from 'lucide-react';

interface DashboardProps {
    config: EvoConfig;
}

const Dashboard: React.FC<DashboardProps> = ({ config }) => {
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        sent: 0,
        failed: 0,
        successRate: 0
    });
    const [chartData, setChartData] = useState<any[]>([]);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();

        // Realtime Subscription
        const channel = supabase
            .channel('dashboard-db-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'schedules' },
                () => {
                    // Debounce simple refresh
                    fetchDashboardData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);

        // 1. Fetch Counts
        const { data: allSchedules } = await supabase
            .from('schedules')
            .select('status, enviar_em, text, instance, type');

        if (allSchedules) {
            const total = allSchedules.length;
            const pending = allSchedules.filter(s => s.status === 'pending').length;
            const sent = allSchedules.filter(s => s.status === 'sent').length;
            const failed = allSchedules.filter(s => s.status === 'failed').length;
            const successRate = sent > 0 ? ((sent / (sent + failed)) * 100).toFixed(1) : 0;

            setStats({
                total,
                pending,
                sent,
                failed,
                successRate: Number(successRate)
            });

            // 2. Prepare Chart Data (Last 7 days)
            const last7Days = [...Array(7)].map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                return d.toISOString().split('T')[0];
            });

            const chart = last7Days.map(date => {
                const daySchedules = allSchedules.filter(s => s.enviar_em.startsWith(date));
                return {
                    name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
                    sent: daySchedules.filter(s => s.status === 'sent').length,
                    failed: daySchedules.filter(s => s.status === 'failed').length
                };
            });
            setChartData(chart);

            // 3. Recent Activity (Last 5 not cancelled)
            setRecentActivity(allSchedules
                .filter(s => s.status !== 'cancelled' && s.status !== 'draft')
                .sort((a, b) => new Date(b.enviar_em).getTime() - new Date(a.enviar_em).getTime())
                .slice(0, 5)
            );
        }

        setLoading(false);
    };

    if (loading) return <div className="p-8 text-center text-slate-400">Loading dashboard...</div>;

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                    <p className="text-slate-400">Overview of your messaging campaigns</p>
                </div>
                <div className="text-right">
                    <div className="text-sm text-slate-400">Server Time</div>
                    <div className="font-mono text-emerald-400">{new Date().toLocaleTimeString()}</div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Send size={20} /></div>
                        <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-1 rounded">All Time</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{stats.total}</div>
                    <div className="text-sm text-slate-400">Total Messages</div>
                </div>

                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><CheckCircle size={20} /></div>
                        <span className="text-xs text-emerald-500 font-medium">{stats.successRate}% Success</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{stats.sent}</div>
                    <div className="text-sm text-slate-400">Successfully Sent</div>
                </div>

                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400"><Clock size={20} /></div>
                        <span className="text-xs text-slate-500">Queue</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{stats.pending}</div>
                    <div className="text-sm text-slate-400">Pending Schedule</div>
                </div>

                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-red-500/10 rounded-lg text-red-400"><AlertTriangle size={20} /></div>
                        <span className="text-xs text-red-400">Action Needed</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{stats.failed}</div>
                    <div className="text-sm text-slate-400">Failed Messages</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="lg:col-span-2 bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-lg font-semibold text-white mb-6">Activity (Last 7 Days)</h3>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                    itemStyle={{ color: '#e2e8f0' }}
                                />
                                <Bar dataKey="sent" name="Sent" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Activity List */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-lg font-semibold text-white mb-6">Recent Activity</h3>
                    <div className="space-y-4">
                        {recentActivity.map((activity, i) => (
                            <div key={i} className="flex gap-3 items-start pb-4 border-b border-slate-700/50 last:border-0 last:pb-0">
                                <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0
                                    ${activity.status === 'sent' ? 'bg-emerald-500' :
                                        activity.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'}`}
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-white truncate">{activity.text || `[${activity.type}]`}</p>
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-xs text-slate-500">{activity.instance}</span>
                                        <span className="text-xs text-slate-500">{new Date(activity.enviar_em).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {recentActivity.length === 0 && <div className="text-slate-500 text-sm">No recent activity.</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

import { supabase } from '../services/supabaseClient';
import { getApiClient } from '../services/apiAdapter';
import { EvoConfig, Schedule } from '../types';

// Polyfill fetch if needed (Node 18+ has it)
if (!globalThis.fetch) {
    console.warn('Fetch API not found, ensure Node 18+');
}

const POLL_INTERVAL = 5000; // 5 seconds
const EVOLUTION_URL = process.env.EVOLUTION_API_URL || process.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080';

console.log('Worker starting...');
console.log('Configuration:', {
    evolutionUrl: EVOLUTION_URL,
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    supabaseKey: (process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY)?.substring(0, 5) + '...',
    timezone: process.env.TZ
});
console.log('Worker started. Polling for schedules every 5s...');

const processSchedule = async (schedule: Schedule) => {
    console.log(`Processing schedule #${schedule.id}`);

    // 1. Lock the schedule
    const { data, error: lockError } = await supabase
        .from('schedules')
        .update({ status: 'processing' })
        .eq('id', schedule.id)
        .eq('status', 'pending')
        .select();

    if (lockError || !data || data.length === 0) {
        console.log(`Schedule #${schedule.id} locked or already processed.`);
        return;
    }

    try {
        // 2. Setup API Client
        const config: EvoConfig = {
            baseUrl: EVOLUTION_URL,
            apiKey: schedule.api_key || '', // Use the key from schedule
            mode: 'instance',
            instanceName: schedule.instance,
            provider: 'evolution' // Default
        };
        const api = getApiClient(config);

        // 3. Fetch Groups
        console.log(`Fetching groups for instance ${schedule.instance}...`);
        const groups = await api.fetchGroups(schedule.instance);
        if (!Array.isArray(groups)) {
            throw new Error(`Failed to fetch groups: ${JSON.stringify(groups)}`);
        }

        // 4. Filter Groups
        const filter = JSON.parse(schedule.group_filter || '{}');
        const targetGroups = groups.filter((g: any) => {
            // If IDs are provided, filter by ID list
            if (filter.ids && Array.isArray(filter.ids) && filter.ids.length > 0) {
                return filter.ids.includes(g.id);
            }

            // Fallback to dynamic filters
            const nameMatch = !filter.nameContains || (g.subject && g.subject.toLowerCase().includes(filter.nameContains.toLowerCase()));
            const sizeMatch = (g.size || 0) >= (schedule.min_size_group || 0);
            return nameMatch && sizeMatch;
        });

        console.log(`Schedule #${schedule.id}: Found ${targetGroups.length} target groups.`);

        // 5. Send Messages
        let successCount = 0;
        let failCount = 0;

        for (const group of targetGroups) {
            try {
                const payload: any = {
                    number: group.id,
                    text: schedule.text,
                    delay: 1200,
                    mentionsEveryOne: schedule.mention_everyone
                };

                // TODO: Handle Media if schedule.midia is present
                // For now, text only support in this basic worker version

                await api.sendMessage(schedule.instance, 'text', payload);
                successCount++;
                // Rate limit
                await new Promise(r => setTimeout(r, 2000));
            } catch (e) {
                console.error(`Failed to send to group ${group.id}:`, e);
                failCount++;
            }
        }

        // 6. Update Status
        await supabase
            .from('schedules')
            .update({
                status: 'sent',
                enviado_em: new Date().toISOString(),
                error_message: `Sent: ${successCount}, Failed: ${failCount}`
            })
            .eq('id', schedule.id);

        console.log(`Schedule #${schedule.id} completed.`);

    } catch (e: any) {
        console.error(`Error processing schedule #${schedule.id}:`, e);
        await supabase
            .from('schedules')
            .update({
                status: 'failed',
                error_message: e.message
            })
            .eq('id', schedule.id);
    }
};

const run = async () => {
    try {
        const now = new Date().toISOString();
        console.log(`[${now}] Checking for schedules...`);

        const { data: schedules, error } = await supabase
            .from('schedules')
            .select('*')
            .eq('status', 'pending')
            .lte('enviar_em', now);

        if (error) {
            console.error('Error fetching schedules:', error);
            return;
        }

        if (schedules && schedules.length > 0) {
            console.log(`Found ${schedules.length} pending schedules.`);
            // Execute in parallel (independent processes logic)
            // In Node single thread, Promise.all is concurrent.
            await Promise.all(schedules.map(s => processSchedule(s)));
        }
    } catch (e) {
        console.error('Worker loop error:', e);
    }
};

// Start Loop
setInterval(run, POLL_INTERVAL);
run(); // Run immediately on start

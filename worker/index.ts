import 'dotenv/config';
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
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL ? 'Set' : 'Missing',
    supabaseKey: process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing',
    timezone: process.env.TZ
});
console.log('Worker started. Polling for schedules every 5s...');

// Configuration Defaults
let CONFIG = {
    pollInterval: 5000,
    rateLimit: 2000,
    cleanupRetention: 30
};

// Fetch Settings from DB
const loadSettings = async () => {
    try {
        const { data, error } = await supabase.from('settings').select('*');
        if (!error && data) {
            data.forEach((setting: any) => {
                if (setting.key === 'worker_poll_interval_ms') CONFIG.pollInterval = parseInt(setting.value);
                if (setting.key === 'worker_rate_limit_ms') CONFIG.rateLimit = parseInt(setting.value);
                if (setting.key === 'cleanup_retention_days') CONFIG.cleanupRetention = parseInt(setting.value);
            });
            console.log('[Config] Settings loaded:', CONFIG);
        }
    } catch (e) {
        console.error('[Config] Failed to load settings, using defaults.', e);
    }
};

const handleRecurrence = async (schedule: Schedule) => {
    try {
        console.log(`[Recurrence] Processing rule '${schedule.recurrence_rule}' for #${schedule.id}`);
        const currentParams = new Date(schedule.enviar_em);
        let nextDate = new Date(currentParams);

        if (schedule.recurrence_rule === 'daily') {
            nextDate.setDate(nextDate.getDate() + 1);
        } else if (schedule.recurrence_rule === 'weekly') {
            nextDate.setDate(nextDate.getDate() + 7);
        } else if (schedule.recurrence_rule === 'monthly') {
            nextDate.setMonth(nextDate.getMonth() + 1);
        } else {
            return;
        }

        // Clone schedule
        const newPayload = {
            ...schedule,
            id: undefined, // New ID
            enviar_em: nextDate.toISOString(),
            status: 'pending',
            enviado_em: null,
            error_message: null,
            parent_schedule_id: schedule.id // Link to parent
        };

        const { data, error } = await supabase.from('schedules').insert(newPayload).select();

        if (error) {
            console.error('[Recurrence] Failed to spawn next schedule:', error);
        } else {
            console.log(`[Recurrence] Spawned next schedule #${data[0].id} for ${nextDate.toISOString()}`);
        }
    } catch (e) {
        console.error('[Recurrence] Error:', e);
    }
};

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

        if (schedule.type === 'group_action') {
            console.log(`[Worker v2] Processing Group Action: ${schedule.payload?.action}`);
            const { action, value, groupIds } = schedule.payload || {};

            if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
                throw new Error('No target groups specified in payload');
            }

            // Prepare value (e.g., download image if picture update)
            let finalValue = value;
            if (action === 'update_picture' && value && value.startsWith('http')) {
                try {
                    console.log(`[Worker] Downloading image for group picture...`);
                    const imgRes = await fetch(value);
                    if (!imgRes.ok) throw new Error('Failed to download image');
                    const arrayBuffer = await imgRes.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    finalValue = buffer.toString('base64'); // API expects base64
                } catch (e) {
                    console.error('[Worker] Failed to prepare image:', e);
                    throw e;
                }
            }

            let successCount = 0;
            let failCount = 0;

            for (const groupId of groupIds) {
                try {
                    console.log(`[Worker] Executing ${action} on ${groupId}`);

                    // Define Helper for Deep Logging
                    const performAction = async (endpoint: string, body: any) => {
                        const url = `${EVOLUTION_URL.replace(/\/$/, '')}${endpoint.replace(':instance', schedule.instance)}`;
                        const headers = {
                            'Content-Type': 'application/json',
                            'apikey': schedule.api_key || ''
                        };

                        try {
                            const res = await fetch(url, {
                                method: 'POST',
                                headers,
                                body: JSON.stringify(body)
                            });

                            const responseText = await res.text();

                            // Log to Supabase for analysis
                            await supabase.from('api_debug_logs').insert({
                                schedule_id: schedule.id,
                                instance: schedule.instance,
                                action: action,
                                url: url,
                                method: 'POST',
                                request_body: JSON.stringify(body),
                                response_status: res.status,
                                response_body: responseText
                            });

                            if (!res.ok) {
                                throw new Error(`API Error ${res.status}: ${responseText}`);
                            }
                        } catch (err: any) {
                            // Log network/fetch errors too if not already handled
                            if (!err.message.includes('API Error')) {
                                await supabase.from('api_debug_logs').insert({
                                    schedule_id: schedule.id,
                                    instance: schedule.instance,
                                    action: action,
                                    url: url,
                                    method: 'POST',
                                    request_body: JSON.stringify(body),
                                    response_status: 0,
                                    response_body: `Network Error: ${err.message}`
                                });
                            }
                            throw err;
                        }
                    };

                    // Execute based on action
                    if (action === 'update_subject') {
                        await performAction('/group/updateGroupSubject/:instance', { groupJid: groupId, subject: finalValue });
                    }
                    else if (action === 'update_description') {
                        await performAction('/group/updateGroupDescription/:instance', { groupJid: groupId, description: finalValue });
                    }
                    else if (action === 'update_settings') {
                        const settings = Array.isArray(finalValue) ? finalValue : [finalValue];
                        for (const s of settings) {
                            await performAction('/group/updateGroupSetting/:instance', { groupJid: groupId, action: s });
                            await new Promise(r => setTimeout(r, 500));
                        }
                    }
                    else if (action === 'update_picture') {
                        await performAction('/group/updateGroupPicture/:instance', { groupJid: groupId, image: finalValue });
                    }

                    successCount++;
                    await new Promise(r => setTimeout(r, CONFIG.rateLimit));
                } catch (e: any) {
                    console.error(`[Worker] Action failed for ${groupId}:`, e);
                    failCount++;
                    await supabase.from('schedule_failures').insert({
                        schedule_id: schedule.id,
                        group_id: groupId,
                        error_message: e.message || 'Action Failed'
                    });
                }
            }

            // Update Status
            await supabase.from('schedules').update({
                status: 'sent',
                enviado_em: new Date().toISOString(),
                error_message: `Action: ${successCount}, Failed: ${failCount}`
            }).eq('id', schedule.id);

            return; // Exit function after handling group action
        }

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
                const msgType = schedule.type || 'text';
                let payload: any = {
                    number: group.id,
                    delay: 1200,
                    mentionsEveryOne: schedule.mention_everyone
                };

                // Merge specific payload data
                if (schedule.payload) {
                    payload = { ...payload, ...schedule.payload };
                }

                // Backward compatibility for text
                if (msgType === 'text' && !payload.text) {
                    payload.text = schedule.text;
                }

                // If sending media via URL, fetch it and convert to Base64 to ensure delivery
                // This bypasses potential DNS/Network issues on the Evolution API side
                if ((msgType === 'media' || msgType === 'audio') && payload.media && payload.media.startsWith('http')) {
                    try {
                        console.log(`[Worker] Fetching media from ${payload.media}...`);
                        const mediaRes = await fetch(payload.media);
                        if (mediaRes.ok) {
                            // Validating media availability before sending
                            // We do NOT convert to Base64 for videos to avoid ""Maximum call stack size exceeded"" on the API
                            console.log(`[Worker] Validating media URL: ${payload.media}`);
                        } else {
                            throw new Error(`Failed to fetch media: ${mediaRes.statusText}`);
                        }
                    } catch (fetchError: any) {
                        console.error(`[Worker] Error fetching media URL:`, fetchError);
                        throw new Error(`Media fetch failed: ${fetchError.message}`);
                    }
                }

                console.log(`[Worker] Sending message type: ${msgType}`);
                // Don't log full base64 to keep logs clean
                const logPayload = { ...payload, media: payload.media ? (payload.media.substring(0, 50) + '...') : undefined };
                console.log(`[Worker] Payload:`, JSON.stringify(logPayload, null, 2));

                const res = await api.sendMessage(schedule.instance, msgType, payload);
                const responseText = await res.text();

                 // Log to Supabase for analysis
                 await supabase.from('api_debug_logs').insert({
                    schedule_id: schedule.id,
                    instance: schedule.instance,
                    action: 'send_message',
                    url: 'sendMedia/Text',
                    method: 'POST',
                    request_body: JSON.stringify({ ...payload, media: payload.media ? 'BASE64_HIDDEN' : undefined }),
                    response_status: res.status,
                    response_body: responseText
                });

                if (!res.ok) {
                    throw new Error(`API Error ${res.status}: ${responseText}`);
                }
                successCount++;
                // Rate limit
                await new Promise(r => setTimeout(r, CONFIG.rateLimit));
            } catch (e: any) {
                console.error(`Failed to send to group ${group.id}:`, e);
                failCount++;

                // Track failure for Smart Retry
                await supabase.from('schedule_failures').insert({
                    schedule_id: schedule.id,
                    group_id: group.id,
                    error_message: e.message || 'Unknown Error'
                });
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

        // Handle Recurrence
        if (schedule.recurrence_rule && successCount > 0) {
            handleRecurrence(schedule);
        }

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

// Cleanup logic
const cleanupOldMedia = async () => {
    try {
        console.log(`[Cleanup] Starting dirty media cleanup (Retention: ${CONFIG.cleanupRetention} days)...`);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - CONFIG.cleanupRetention);

        // 1. Get old sent schedules with media
        const { data: oldSchedules, error } = await supabase
            .from('schedules')
            .select('payload')
            .eq('status', 'sent')
            .lt('enviar_em', cutoffDate.toISOString())
            .not('payload', 'is', null);

        if (error) {
            console.error('[Cleanup] Error fetching old schedules:', error);
            return;
        }

        if (!oldSchedules || oldSchedules.length === 0) {
            console.log('[Cleanup] No old schedules found.');
            return;
        }

        const filesToDelete: string[] = [];

        // 2. Extract filenames from payloads
        for (const schedule of oldSchedules) {
            const payload = schedule.payload;
            if (payload && payload.media && payload.media.includes('/storage/v1/object/public/schedules/')) {
                // Extract filename from URL
                // URL format: https://.../storage/v1/object/public/schedules/[filename]
                const parts = payload.media.split('/schedules/');
                if (parts.length === 2) {
                    const fileName = parts[1];
                    filesToDelete.push(fileName);
                }
            }
        }

        if (filesToDelete.length === 0) {
            console.log('[Cleanup] No media files to delete.');
            return;
        }

        console.log(`[Cleanup] Found ${filesToDelete.length} files to delete.`);

        // 3. Delete from Storage
        // Supabase remove takes an array of file paths (filenames in bucket root)
        const { data: removeData, error: removeError } = await supabase.storage
            .from('schedules')
            .remove(filesToDelete);

        if (removeError) {
            console.error('[Cleanup] Error deleting files:', removeError);
        } else {
            console.log('[Cleanup] Successfully deleted files:', removeData);
        }

    } catch (e) {
        console.error('[Cleanup] Unexpected error:', e);
    }
};

// Main Loop Wrapper
const startWorker = async () => {
    await loadSettings();

    // Initial run
    run();
    cleanupOldMedia();

    // Poll Loop
    setInterval(() => {
        run();
    }, CONFIG.pollInterval);

    // Cleanup Loop (24h)
    setInterval(cleanupOldMedia, 86400000);

    // Refresh Settings Loop (every 1 hour)
    setInterval(loadSettings, 3600000);
};

startWorker();

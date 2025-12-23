import { supabase } from './services/supabaseClient'; (async () => { const { data, error } = await supabase.storage.listBuckets(); console.log(data); })()

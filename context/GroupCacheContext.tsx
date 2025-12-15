import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { EvoConfig, Group } from '../types';
import { getApiClient } from '../services/apiAdapter';
import { useLogs } from './LogContext';

interface GroupCacheContextType {
    groups: Record<string, Group[]>; // Map instanceName -> groups
    getGroups: (instanceName: string) => Group[];
    refreshGroups: (instanceName: string) => Promise<void>;
    loading: Record<string, boolean>;
}

const GroupCacheContext = createContext<GroupCacheContextType | undefined>(undefined);

export const GroupCacheProvider: React.FC<{ children: React.ReactNode; config: EvoConfig | null }> = ({ children, config }) => {
    const { addLog } = useLogs();
    const [groups, setGroups] = useState<Record<string, Group[]>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [instances, setInstances] = useState<string[]>([]);

    // We need a ref to access current instances in the interval closure if we don't want to re-trigger effect constantly
    // or we can just fetch instances list inside the cycle.

    const api = config ? getApiClient(config) : null;

    // Helper to fetch for one instance
    const fetchForInstance = async (instName: string) => {
        if (!api) return;

        // Don't set global loading state to avoid UI flicker, just background update
        // But we DO want to track "is fetching" for manual refresh buttons
        setLoading(prev => ({ ...prev, [instName]: true }));

        try {
            const data = await api.fetchGroups(instName);
            if (Array.isArray(data)) {
                setGroups(prev => ({ ...prev, [instName]: data }));
            }
        } catch (e) {
            console.error(`Background fetch failed for ${instName}`, e);
        } finally {
            setLoading(prev => ({ ...prev, [instName]: false }));
        }
    };

    // The polling machine
    useEffect(() => {
        if (!config || !api) return;

        let isMounted = true;

        const runCycle = async () => {
            if (!isMounted) return;

            try {
                // 1. Get Instances (to know who to poll)
                // If mode is 'instance', we only have one.
                // If mode is 'global', we fetch all.
                let targetInstances: string[] = [];

                if (config.mode === 'instance' && config.instanceName) {
                    targetInstances = [config.instanceName];
                } else {
                    const instData = await api.fetchInstances();
                    if (Array.isArray(instData)) {
                        targetInstances = instData
                            .filter((d: any) => d?.instance?.instanceName || d?.instanceName || d?.name)
                            .map((d: any) => d?.instance?.instanceName || d?.instanceName || d?.name);
                    }
                }

                if (targetInstances.length > 0) {
                    setInstances(targetInstances); // Update known instances

                    // 2. Fetch groups for ALL instances in parallel
                    // We limit concurrency slightly if needed, but for < 50 instances Promise.all is fine.
                    await Promise.all(targetInstances.map(inst => fetchForInstance(inst)));
                }
            } catch (e) {
                console.error('Group Poll Cycle Error', e);
            }
        };

        // Run immediately on mount
        runCycle();

        // Setup interval
        const intervalId = setInterval(runCycle, 60 * 1000); // 60 seconds

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [config?.apiKey, config?.baseUrl]); // Re-run if auth changes

    const getGroups = (instanceName: string) => {
        return groups[instanceName] || [];
    };

    const refreshGroups = async (instanceName: string) => {
        await fetchForInstance(instanceName);
    };

    return (
        <GroupCacheContext.Provider value={{ groups, getGroups, refreshGroups, loading }}>
            {children}
        </GroupCacheContext.Provider>
    );
};

export const useGroupCache = () => {
    const context = useContext(GroupCacheContext);
    if (!context) {
        throw new Error('useGroupCache must be used within a GroupCacheProvider');
    }
    return context;
};

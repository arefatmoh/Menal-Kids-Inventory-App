import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabase/client';

interface Branch {
    id: string;
    name: string;
    address?: string;
}

interface BranchContextType {
    currentBranchId: string | null;
    currentBranch: Branch | null;
    branches: Branch[];
    setCurrentBranchId: (id: string) => void;
    loading: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: React.ReactNode }) {
    const [currentBranchId, setCurrentBranchId] = useState<string | null>(localStorage.getItem('menal_branch_id'));
    const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBranches();
    }, []);

    const fetchBranches = async () => {
        try {
            const { data, error } = await supabase
                .from('menal_branches')
                .select('*')
                .order('name');

            if (error) throw error;
            setBranches(data || []);

            // If no branch selected, or selected branch doesn't exist, default to first one
            if (data && data.length > 0) {
                if (!currentBranchId || !data.find(b => b.id === currentBranchId)) {
                    const defaultBranch = data[0];
                    setCurrentBranchId(defaultBranch.id);
                    localStorage.setItem('menal_branch_id', defaultBranch.id);
                }
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentBranchId && branches.length > 0) {
            const branch = branches.find(b => b.id === currentBranchId);
            setCurrentBranch(branch || null);
        }
    }, [currentBranchId, branches]);

    const updateBranchId = (id: string) => {
        setCurrentBranchId(id);
        localStorage.setItem('menal_branch_id', id);
    };

    return (
        <BranchContext.Provider value={{
            currentBranchId,
            currentBranch,
            branches,
            setCurrentBranchId: updateBranchId,
            loading
        }}>
            {children}
        </BranchContext.Provider>
    );
}

export function useBranch() {
    const context = useContext(BranchContext);
    if (context === undefined) {
        throw new Error('useBranch must be used within a BranchProvider');
    }
    return context;
}

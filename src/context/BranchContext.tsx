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
    // Get stored branch ID from localStorage, with fallback to null
    const getStoredBranchId = () => {
        try {
            const stored = localStorage.getItem('menal_branch_id');
            console.log('Stored branch ID from localStorage:', stored);
            return stored;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return null;
        }
    };

    const [currentBranchId, setCurrentBranchId] = useState<string | null>(getStoredBranchId());
    const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBranches();
    }, []);

    const fetchBranches = async () => {
        try {
            console.log('Fetching branches...');
            const { data, error } = await supabase
                .from('menal_branches')
                .select('*')
                .order('name');

            if (error) throw error;
            console.log('Fetched branches:', data);
            setBranches(data || []);

            // Handle branch selection logic
            if (data && data.length > 0) {
                console.log('Current branch ID from state:', currentBranchId);
                
                if (!currentBranchId) {
                    // No branch selected, use first one
                    console.log('No branch selected, using first branch as default');
                    const defaultBranch = data[0];
                    setCurrentBranchId(defaultBranch.id);
                    localStorage.setItem('menal_branch_id', defaultBranch.id);
                    console.log('Set default branch to:', defaultBranch.id);
                } else {
                    // Check if the stored branch still exists
                    const storedBranchExists = data.find(b => b.id === currentBranchId);
                    console.log('Stored branch exists:', storedBranchExists);
                    
                    if (!storedBranchExists) {
                        // Stored branch no longer exists, use first one
                        console.log('Stored branch no longer exists, using first branch');
                        const defaultBranch = data[0];
                        setCurrentBranchId(defaultBranch.id);
                        localStorage.setItem('menal_branch_id', defaultBranch.id);
                        console.log('Updated to new default branch:', defaultBranch.id);
                    } else {
                        // Stored branch exists, keep using it
                        console.log('Keeping stored branch:', currentBranchId);
                    }
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
            console.log('Setting current branch:', branch);
            setCurrentBranch(branch || null);
        }
    }, [currentBranchId, branches]);

    const updateBranchId = (id: string) => {
        console.log('Updating branch ID to:', id);
        setCurrentBranchId(id);
        try {
            localStorage.setItem('menal_branch_id', id);
            console.log('Successfully saved branch ID to localStorage');
        } catch (error) {
            console.error('Error saving branch ID to localStorage:', error);
        }
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

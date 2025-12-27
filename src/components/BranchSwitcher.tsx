import React from 'react';
import { LayoutGrid, ChevronDown } from 'lucide-react';
import { useBranch } from '../context/BranchContext';

export function BranchSwitcher() {
    const { branches, currentBranchId, setCurrentBranchId, currentBranch } = useBranch();

    if (branches.length <= 1) return null;

    return (
        <div className="relative inline-block text-left">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all hover:bg-opacity-80"
                style={{
                    backgroundColor: 'var(--gray-light)',
                    borderColor: 'var(--border)',
                    cursor: 'pointer'
                }}>
                <LayoutGrid size={16} style={{ color: 'var(--primary)' }} />
                <select
                    value={currentBranchId || ''}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCurrentBranchId(e.target.value)}
                    className="appearance-none bg-transparent border-none focus:outline-none text-sm font-medium pr-6"
                    style={{ color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                    {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                            {branch.name}
                        </option>
                    ))}
                </select>
                {/* Removed duplicate icon */}
            </div>
        </div>
    );
}

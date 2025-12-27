export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-6">
          {/* Outer ring */}
          <div 
            className="absolute inset-0 rounded-full border-4 animate-spin"
            style={{ 
              borderColor: 'var(--secondary)',
              borderTopColor: 'var(--primary)',
              animation: 'spin 1s linear infinite'
            }}
          />
          {/* Inner dot */}
          <div 
            className="absolute inset-0 m-auto w-3 h-3 rounded-full"
            style={{ 
              backgroundColor: 'var(--primary)',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}
          />
        </div>
        <p className="animate-pulse" style={{ color: 'var(--text-primary)' }}>
          {message}
        </p>
      </div>
    </div>
  );
}

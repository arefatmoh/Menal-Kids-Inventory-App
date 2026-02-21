import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import {
  Home,
  Package,
  ShoppingCart,
  History,
  Users,
  LayoutGrid
} from "lucide-react";
import { Dashboard } from "./components/Dashboard";
import { Products } from "./components/Products";
import { Sell } from "./components/Sell";
import { Expenses } from "./components/Expenses";
import { HistoryView } from "./components/HistoryView";
import { Customers } from "./components/Customers";
import { Login } from "./components/Login";
import { ProfileDropdown } from "./components/ProfileDropdown";
import { CustomerSegmentation } from "./components/CustomerSegmentation";
import { LaunchCelebration } from "./components/LaunchCelebration";
import { BranchSwitcher } from "./components/BranchSwitcher";
import { Toaster } from "sonner";
import { toast } from "sonner";
import { useFavicon } from "./utils/useFavicon";
import { useLaunchCelebration } from "./utils/useLaunchCelebration";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { BranchProvider, useBranch } from "./context/BranchContext";
import { ExcelUpload } from "./components/ExcelUpload";


export default function App() {
  // Set favicon
  useFavicon();

  return (
    <ErrorBoundary>
      <BranchProvider>
        <Router>
          <AppContent />
        </Router>
      </BranchProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState<string>("user");
  const { setCurrentBranchId, currentBranch } = useBranch();
  const navigate = useNavigate();
  const location = useLocation();
  const { shouldShow, markAsSeen } = useLaunchCelebration();
  const [showLaunchCelebration, setShowLaunchCelebration] = useState(false);

  // Check if user is already logged in
  useEffect(() => {
    const storedUser = localStorage.getItem('menal_user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setIsLoggedIn(true);
        setUsername(userData.username);
        setUserRole(userData.role || "user");
        
        // Only set branch from user data if no branch is already stored in localStorage
        // This preserves manual branch selection by admin/owner users
        const storedBranchId = localStorage.getItem('menal_branch_id');
        if (!storedBranchId && userData.branch_id) {
          console.log('Setting branch from user data (no manual selection found):', userData.branch_id);
          setCurrentBranchId(userData.branch_id);
        } else if (storedBranchId) {
          console.log('Keeping manually selected branch:', storedBranchId);
        }
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('menal_user');
      }
    }
  }, []);

  // Show launch celebration after login
  useEffect(() => {
    if (isLoggedIn && shouldShow) {
      // Small delay to let the main app render first
      const timer = setTimeout(() => {
        setShowLaunchCelebration(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, shouldShow]);

  const handleLoginSuccess = (user: string, role: string, branchId: string) => {
    setIsLoggedIn(true);
    setUsername(user);
    setUserRole(role || "user");
    
    // Only set branch from login if no branch is already stored in localStorage
    const storedBranchId = localStorage.getItem('menal_branch_id');
    if (!storedBranchId && branchId) {
      console.log('Setting branch from login (no manual selection found):', branchId);
      setCurrentBranchId(branchId);
    } else if (storedBranchId) {
      console.log('Keeping manually selected branch after login:', storedBranchId);
    }
    
    navigate("/");
  };

  const handleLogout = () => {
    localStorage.removeItem('menal_user');
    setIsLoggedIn(false);
    setUsername("");
    setUserRole("user");
    navigate("/");
    toast.success("Logged out successfully");
  };

  const isAdmin = userRole === "admin";

  // Show login page if not logged in
  if (!isLoggedIn) {
    return (
      <>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: 'var(--background)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            },
          }}
          richColors
        />
        <Login onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  const renderView = (view: string) => {
    switch (view) {
      case "home":
        return <Dashboard isAdmin={isAdmin} />;
      case "products":
        return <Products isAdmin={isAdmin} />;
      case "sell":
        return <Sell />;
      case "expenses":
        return <Expenses />;
      case "history":
        return <HistoryView />;
      case "customers":
        return <Customers />;
      case "customerManagement":
        return isAdmin ? <CustomerSegmentation onBack={() => navigate("/")} /> : <Dashboard isAdmin={isAdmin} />;
      case "excel":
        return isAdmin ? <ExcelUpload /> : <Dashboard isAdmin={isAdmin} />;
      default:
        return <Dashboard isAdmin={isAdmin} />;
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--background)" }}
    >
      {/* Toast Notifications */}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--background)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          },
        }}
        richColors
      />

      {/* Header */}
      <header
        className="sticky top-0 z-20 shadow-sm"
        style={{
          backgroundColor: "var(--background)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{
          maxWidth: 'var(--container-max-width)',
          margin: '0 auto',
          padding: 'var(--container-padding) var(--container-padding) 16px var(--container-padding)'
        }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 style={{ color: "var(--text-primary)", margin: 0 }}>
                Menal Kids
              </h2>
              {isAdmin ? (
                <BranchSwitcher />
              ) : (
                currentBranch && (
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all"
                    style={{
                      backgroundColor: 'var(--gray-light)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <LayoutGrid size={16} style={{ color: 'var(--primary)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {currentBranch.name}
                    </span>
                  </div>
                )
              )}
            </div>
            <ProfileDropdown
              onLogout={handleLogout}
              username={username}
              userRole={userRole}
              onCustomerManagementClick={() => navigate("/customerManagement")}
              onExpensesClick={() => navigate("/expenses")}
              onExcelClick={() => navigate("/excel")}
            />
          </div>
        </div>
      </header>

      {/* Main Content with proper margins */}
      <main style={{
        maxWidth: 'var(--container-max-width)',
        margin: '0 auto',
        padding: 'var(--container-padding)',
        paddingBottom: '120px'
      }}>
        <Routes>
          <Route path="/" element={renderView("home")} />
          <Route path="/products" element={renderView("products")} />
          <Route path="/sell" element={renderView("sell")} />
          <Route path="/expenses" element={renderView("expenses")} />
          <Route path="/history" element={renderView("history")} />
          <Route path="/customers" element={renderView("customers")} />
          <Route path="/customerManagement" element={renderView("customerManagement")} />
          <Route path="/excel" element={renderView("excel")} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      {/* Bottom Navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-20"
        style={{
          backgroundColor: "var(--background)",
          borderTop: "1px solid var(--border)",
          boxShadow: "0 -2px 12px rgba(0, 0, 0, 0.06)",
        }}
      >
        <div style={{ maxWidth: '512px', margin: '0 auto', padding: '8px 12px' }}>
          <div className="flex items-center justify-around">
            <NavButton
              icon={<Home size={23} strokeWidth={location.pathname === "/" ? 2.5 : 2} />}
              label="Home"
              active={location.pathname === "/"}
              onClick={() => navigate("/")}
            />
            <NavButton
              icon={<Package size={23} strokeWidth={location.pathname === "/products" ? 2.5 : 2} />}
              label="Products"
              active={location.pathname === "/products"}
              onClick={() => navigate("/products")}
            />
            <NavButton
              icon={<ShoppingCart size={23} strokeWidth={location.pathname === "/sell" ? 2.5 : 2} />}
              label="Sell"
              active={location.pathname === "/sell"}
              onClick={() => navigate("/sell")}
            />
            <NavButton
              icon={<Users size={23} strokeWidth={location.pathname === "/customers" ? 2.5 : 2} />}
              label="Customers"
              active={location.pathname === "/customers"}
              onClick={() => navigate("/customers")}
            />
            <NavButton
              icon={<History size={23} strokeWidth={location.pathname === "/history" ? 2.5 : 2} />}
              label="History"
              active={location.pathname === "/history"}
              onClick={() => navigate("/history")}
            />
          </div>
        </div>
      </nav>

      {/* Launch Celebration */}
      {showLaunchCelebration && (
        <LaunchCelebration
          onClose={() => {
            setShowLaunchCelebration(false);
            markAsSeen();
          }}
        />
      )}
    </div>
  );
}

interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function NavButton({
  icon,
  label,
  active,
  onClick,
}: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center transition-all"
      style={{
        color: active ? "var(--primary)" : "var(--text-secondary)",
        padding: "6px 8px",
        gap: "4px"
      }}
    >
      {icon}
      <span
        className="text-xs"
        style={{ fontWeight: active ? 600 : 400 }}
      >
        {label}
      </span>
    </button>
  );
}
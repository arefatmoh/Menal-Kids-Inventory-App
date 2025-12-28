import { useState } from "react";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Mail,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../utils/supabase/client";
import { MenalLogo } from "./MenalLogo";

interface LoginProps {
  onLoginSuccess: (username: string, role: string, branch_id: string) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error("Please enter username and password");
      return;
    }

    setLoading(true);

    try {
      // Query the profiles table
      const { data, error } = await supabase
        .from("menal_profiles")
        .select("*")
        .eq("username", username)
        .eq("password", password)
        .single();

      if (error || !data) {
        toast.error("Invalid username or password");
        setLoading(false);
        return;
      }

      // Login successful
      toast.success(`Welcome back, ${data.username}! ✨`);

      // Store user info in localStorage
      localStorage.setItem(
        "menal_user",
        JSON.stringify({
          username: data.username,
          role: data.role,
          branch_id: data.branch_id,
          loginTime: new Date().toISOString(),
        }),
      );

      // Store branch ID separately for context persistence
      if (data.branch_id) {
        localStorage.setItem('menal_branch_id', data.branch_id);
      }

      // Call parent callback
      onLoginSuccess(data.username, data.role, data.branch_id);
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 min-h-screen flex items-center justify-center relative overflow-hidden font-nunito" style={{ padding: '20px', minHeight: '100dvh' }}>
      {/* Decorative circles */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "5%",
          width: "100px",
          height: "100px",
          borderRadius: "50%",
          backgroundColor: "var(--secondary)",
          opacity: 0.3,
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "15%",
          right: "10%",
          width: "150px",
          height: "150px",
          borderRadius: "50%",
          backgroundColor: "var(--primary)",
          opacity: 0.2,
          filter: "blur(50px)",
        }}
      />

      {/* Login Card */}
      <div
        className="w-full max-w-md rounded-3xl shadow-2xl"
        style={{
          backgroundColor: "var(--background)",
          padding: "8px 8px 16px 8px",
          position: "relative",
          zIndex: 1,
          animation: "slideDown 0.6s ease-out",
        }}
      >
        {/* Logo/Brand Area */}
        <div
          className="text-center"
          style={{ marginBottom: "12px", paddingTop: "12px" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: "0",
            }}
          >
            <MenalLogo
              style={{
                width: "130px",
                height: "auto",
                maxWidth: "100%",
                filter:
                  "drop-shadow(0 4px 20px rgba(113, 67, 41, 0.15))",
              }}
              onError={(e) => {
                // Fallback to a colored circle with text if logo fails to load
                e.currentTarget.style.display = "none";
                const fallback = document.createElement("div");
                fallback.style.cssText = `
                  width: 80px;
                  height: 80px;
                  background-color: var(--primary);
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-center;
                  color: white;
                  font-weight: bold;
                  font-size: 32px;
                  box-shadow: 0 10px 30px rgba(113, 67, 41, 0.3);
                `;
                fallback.textContent = "SC";
                e.currentTarget.parentElement?.appendChild(
                  fallback,
                );
              }}
            />
          </div>
          <p
            className="text-sm"
            style={{
              color: "var(--text-secondary)",
              letterSpacing: "0.5px",
              marginTop: "2px",
            }}
          >
            Inventory & Sales Management
          </p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleLogin}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {/* Username Field */}
          <div>
            <label
              className="block text-sm"
              style={{
                color: "var(--text-primary)",
                marginBottom: "8px",
                fontWeight: "500",
              }}
            >
              Username
            </label>
            <div
              className="flex items-center gap-3 rounded-xl border"
              style={{
                backgroundColor: "var(--gray-light)",
                borderColor: "var(--border)",
                padding: "14px 16px",
                transition: "all 0.3s ease",
              }}
            >
              <User
                size={20}
                style={{ color: "var(--text-secondary)" }}
              />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="flex-1 bg-transparent border-none outline-none"
                style={{
                  color: "var(--text-primary)",
                  fontSize: "15px",
                }}
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label
              className="block text-sm"
              style={{
                color: "var(--text-primary)",
                marginBottom: "8px",
                fontWeight: "500",
              }}
            >
              Password
            </label>
            <div
              className="flex items-center gap-3 rounded-xl border"
              style={{
                backgroundColor: "var(--gray-light)",
                borderColor: "var(--border)",
                padding: "14px 16px",
                transition: "all 0.3s ease",
              }}
            >
              <Lock
                size={20}
                style={{ color: "var(--text-secondary)" }}
              />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="flex-1 bg-transparent border-none outline-none"
                style={{
                  color: "var(--text-primary)",
                  fontSize: "15px",
                }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="transition-all"
                style={{
                  background: "none",
                  border: "none",
                  padding: "0",
                  cursor: "pointer",
                }}
              >
                {showPassword ? (
                  <EyeOff
                    size={20}
                    style={{ color: "var(--text-secondary)" }}
                  />
                ) : (
                  <Eye
                    size={20}
                    style={{ color: "var(--text-secondary)" }}
                  />
                )}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl transition-all active:scale-98 disabled:opacity-50"
            style={{
              backgroundColor: "var(--primary)",
              color: "#FFFFFF",
              padding: "16px",
              border: "none",
              fontSize: "16px",
              fontWeight: "600",
              marginTop: "12px",
              boxShadow: "0 4px 20px rgba(113, 67, 41, 0.3)",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid #FFFFFF",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Logging in...
              </span>
            ) : (
              "Login"
            )}
          </button>
        </form>

        {/* Developer Information - Compact Footer */}
        <div
          style={{
            marginTop: "28px",
            paddingTop: "20px",
            borderTop: "1px solid var(--border)",
          }}
        >
          {/* Developer Name */}
          <div
            className="text-center"
            style={{ marginBottom: "10px" }}
          >
            <p
              className="text-xs"
              style={{
                color: "var(--text-secondary)",
              }}
            >
              Developed By{" "}
              <span
                style={{
                  color: "var(--primary)",
                  fontWeight: "600",
                }}
              >
                Arefat Mohammed
              </span>
            </p>
          </div>

          {/* Contact Info - Single Row */}
          <div style={{ display: "flex", gap: "8px" }}>
            <a
              href="tel:0937106996"
              className="flex items-center justify-center gap-2 rounded-lg transition-all flex-1"
              style={{
                padding: "8px 12px",
                backgroundColor: "var(--gray-light)",
                color: "var(--text-primary)",
                textDecoration: "none",
                fontSize: "12px",
              }}
            >
              <Phone
                size={13}
                style={{ color: "var(--primary)" }}
              />
              <span>0937106996</span>
            </a>

            <a
              href="mailto:arefatmohammed161@gmail.com"
              className="flex items-center justify-center gap-2 rounded-lg transition-all flex-1"
              style={{
                padding: "8px 12px",
                backgroundColor: "var(--gray-light)",
                color: "var(--text-primary)",
                textDecoration: "none",
                fontSize: "12px",
              }}
            >
              <Mail
                size={13}
                style={{ color: "var(--primary)" }}
              />
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Email
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .active\\:scale-98:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  );
}
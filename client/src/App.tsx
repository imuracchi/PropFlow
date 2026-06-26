import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Login from "./pages/Login";
import PropertyList from "./pages/PropertyList";
import PropertyDetail from "./pages/PropertyDetail";
import PropertyUpload from "./pages/PropertyUpload";
import ChatList from "./pages/ChatList";
import ChatRoom from "./pages/ChatRoom";
import DirectMessage from "./pages/DirectMessage";
import Favorites from "./pages/Favorites";
import MyPage from "./pages/MyPage";
import Admin from "./pages/Admin";
import InterestedUsers from "./pages/InterestedUsers";
import Features from "./pages/Features";
import BuyerPreference from "./pages/BuyerPreference";
import DocumentList from "./pages/DocumentList";
import Simulation from "./pages/Simulation";
import Register from "./pages/Register";
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { trpc } from "./lib/trpc";
import { useEffect } from "react";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

function usePushNotification() {
  const subscribeMutation = trpc.auth.subscribePush.useMutation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !VAPID_PUBLIC_KEY || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        const key = existing.getKey("p256dh");
        const auth = existing.getKey("auth");
        if (key && auth) {
          subscribeMutation.mutate({
            endpoint: existing.endpoint,
            p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
            auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
          });
        }
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY,
      });
      const key = sub.getKey("p256dh");
      const auth = sub.getKey("auth");
      if (key && auth) {
        subscribeMutation.mutate({
          endpoint: sub.endpoint,
          p256dh: btoa(String.fromCharCode(...new Uint8Array(key))),
          auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
        });
      }
    }).catch(() => {});
  }, [isAuthenticated]);
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, refresh } = useAuth();
  usePushNotification();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => refresh()} />;
  }

  return <>{children}</>;
}

function AdminRoute() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user?.role !== "admin") {
    setLocation("/properties");
    return null;
  }

  return (
    <DashboardLayout>
      <Admin />
    </DashboardLayout>
  );
}

function AppContent() {
  const [, setLocation] = useLocation();

  return (
    <Switch>
      <Route path="/register/:token">
        {() => <Register />}
      </Route>
      <Route>
        {() => (
    <AuthGuard>
      <Switch>
        <Route path="/properties">
          {() => (
            <DashboardLayout>
              <PropertyList />
            </DashboardLayout>
          )}
        </Route>
        <Route path="/property/:id">
          {() => (
            <DashboardLayout>
              <PropertyDetail />
            </DashboardLayout>
          )}
        </Route>
        <Route path="/upload">
          {() => (
            <DashboardLayout>
              <PropertyUpload />
            </DashboardLayout>
          )}
        </Route>
        <Route path="/dm/:id/:propertyId">
          {() => (<DashboardLayout><DirectMessage /></DashboardLayout>)}
        </Route>
        <Route path="/dm/:id">
          {() => (<DashboardLayout><DirectMessage /></DashboardLayout>)}
        </Route>
        <Route path="/chat/:id">
          {() => (
            <DashboardLayout>
              <ChatRoom />
            </DashboardLayout>
          )}
        </Route>
        <Route path="/dm-sell">
          {() => (
            <DashboardLayout>
              <ChatList mode="owner-dm" />
            </DashboardLayout>
          )}
        </Route>
        <Route path="/chat-sell">
          {() => (
            <DashboardLayout>
              <ChatList mode="owner" />
            </DashboardLayout>
          )}
        </Route>
        <Route path="/dm-list">
          {() => (
            <DashboardLayout>
              <ChatList />
            </DashboardLayout>
          )}
        </Route>
        <Route path="/simulation/:id">
          {() => (<DashboardLayout><Simulation /></DashboardLayout>)}
        </Route>
        <Route path="/documents">
          {() => (<DashboardLayout><DocumentList /></DashboardLayout>)}
        </Route>
        <Route path="/buyer-preference">
          {() => (<DashboardLayout><BuyerPreference /></DashboardLayout>)}
        </Route>
        <Route path="/my-properties">
          {() => (<DashboardLayout><PropertyList mode="mine" /></DashboardLayout>)}
        </Route>
        <Route path="/favorites">
          {() => (<DashboardLayout><Favorites /></DashboardLayout>)}
        </Route>
        <Route path="/mypage">
          {() => (<DashboardLayout><MyPage key="mypage" /></DashboardLayout>)}
        </Route>
        <Route path="/interested">
          {() => (<DashboardLayout><InterestedUsers /></DashboardLayout>)}
        </Route>
        <Route path="/features">
          {() => (<DashboardLayout><Features /></DashboardLayout>)}
        </Route>
        <Route path="/admin">
          {() => <AdminRoute />}
        </Route>
        <Route path="/">
          {() => (
            <DashboardLayout>
              <PropertyList />
            </DashboardLayout>
          )}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AuthGuard>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

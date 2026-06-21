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
        <Route path="/chat">
          {() => (
            <DashboardLayout>
              <ChatList />
            </DashboardLayout>
          )}
        </Route>
        <Route path="/favorites">
          {() => (<DashboardLayout><Favorites /></DashboardLayout>)}
        </Route>
        <Route path="/mypage">
          {() => (<DashboardLayout><MyPage key="mypage" /></DashboardLayout>)}
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

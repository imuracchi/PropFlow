import React from "react";
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
import DirectMessage from "./pages/DirectMessage";
import Favorites from "./pages/Favorites";
import MyPage from "./pages/MyPage";
import Admin from "./pages/Admin";
import InterestedUsers from "./pages/InterestedUsers";
import Features from "./pages/Features";
import AnnounceArchive from "./pages/AnnounceArchive";
import BuyerPreference from "./pages/BuyerPreference";
import DocumentList from "./pages/DocumentList";
import Simulation from "./pages/Simulation";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ViewRanking from "./pages/ViewRanking";
import NewDashboard from "./pages/NewDashboard";
import DesignPropertyDetail from "./pages/DesignPropertyDetail";
import DesignChat from "./pages/DesignChat";
import DesignUpload from "./pages/DesignUpload";
import DesignChatList from "./pages/DesignChatList";
import DesignMyPage from "./pages/DesignMyPage";
import DesignDocuments from "./pages/DesignDocuments";
import DesignSimulation from "./pages/DesignSimulation";
import DesignPropertyCollection from "./pages/DesignPropertyCollection";
import DesignAuth from "./pages/DesignAuth";
import DesignInterested from "./pages/DesignInterested";
import DesignAnnouncements from "./pages/DesignAnnouncements";
import DesignFeatures from "./pages/DesignFeatures";
import DesignStates from "./pages/DesignStates";
import DesignDesktopProperties from "./pages/DesignDesktopProperties";
import DesignDesktopProperty from "./pages/DesignDesktopProperty";
import DesignDesktopMessages from "./pages/DesignDesktopMessages";
import V2PropertyList from "./pages/v2/V2PropertyList";
import V2PropertyDetail from "./pages/v2/V2PropertyDetail";
import V2Messages from "./pages/v2/V2Messages";
import V2Chat from "./pages/v2/V2Chat";
import V2MyPage from "./pages/v2/V2MyPage";
import V2Documents from "./pages/v2/V2Documents";
import V2Admin from "./pages/v2/V2Admin";

const V2_DEFAULT = import.meta.env.VITE_V2_DEFAULT === "true";
import V2Layout from "./components/v2/V2Layout";
import { useAuth } from "./_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { trpc } from "./lib/trpc";
import { useEffect } from "react";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

function usePushNotification() {
  const subscribeMutation = trpc.auth.subscribePush.useMutation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (
      !isAuthenticated ||
      !VAPID_PUBLIC_KEY ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    )
      return;

    navigator.serviceWorker
      .register("/sw.js")
      .then(async reg => {
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
      })
      .catch(() => {});
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

function AdminRoute({ v2 = false }: { v2?: boolean }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user?.role !== "admin" && user?.role !== "management") {
    setLocation(v2 ? "/v2/properties" : "/properties");
    return null;
  }

  if (v2) return <V2Admin />;
  return (
    <DashboardLayout>
      <Admin />
    </DashboardLayout>
  );
}

function ManagementRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user?.role !== "management") {
    setLocation("/properties");
    return null;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

function AppContent() {
  const [, setLocation] = useLocation();

  return (
    <Switch>
      <Route path="/design/pc/property">
        {() => <DesignDesktopProperty />}
      </Route>
      <Route path="/design/pc/messages">
        {() => <DesignDesktopMessages />}
      </Route>
      <Route path="/design/pc">{() => <DesignDesktopProperties />}</Route>
      <Route path="/design/login">{() => <DesignAuth mode="login" />}</Route>
      <Route path="/design/register">
        {() => <DesignAuth mode="register" />}
      </Route>
      <Route path="/design/forgot-password">
        {() => <DesignAuth mode="forgot" />}
      </Route>
      <Route path="/design/reset-password">
        {() => <DesignAuth mode="reset" />}
      </Route>
      <Route path="/design/interested">{() => <DesignInterested />}</Route>
      <Route path="/design/announcements">
        {() => <DesignAnnouncements />}
      </Route>
      <Route path="/design/features">{() => <DesignFeatures />}</Route>
      <Route path="/design/states">{() => <DesignStates />}</Route>
      <Route path="/design/messages-owner">
        {() => <DesignChatList mode="owner" />}
      </Route>
      <Route path="/design/mypage">{() => <DesignMyPage />}</Route>
      <Route path="/design/documents">{() => <DesignDocuments />}</Route>
      <Route path="/design/simulation">{() => <DesignSimulation />}</Route>
      <Route path="/design/favorites">
        {() => <DesignPropertyCollection mode="favorites" />}
      </Route>
      <Route path="/design/my-properties">
        {() => <DesignPropertyCollection mode="mine" />}
      </Route>
      <Route path="/design/upload">{() => <DesignUpload />}</Route>
      <Route path="/design/messages">{() => <DesignChatList />}</Route>
      <Route path="/design/property">{() => <DesignPropertyDetail />}</Route>
      <Route path="/design/chat">{() => <DesignChat />}</Route>
      <Route path="/design">{() => <NewDashboard />}</Route>
      <Route path="/v2/preview/property">
        {() => <V2PropertyDetail preview />}
      </Route>
      <Route path="/v2/preview/messages">{() => <V2Messages preview />}</Route>
      <Route path="/v2/preview/favorites">
        {() => <V2PropertyList preview collection="favorites" />}
      </Route>
      <Route path="/v2/preview/my-properties">
        {() => <V2PropertyList preview collection="mine" />}
      </Route>
      <Route path="/v2/preview/chat">{() => <V2Chat preview />}</Route>
      <Route path="/v2/preview/mypage">
        {() => <V2Layout preview><div className="[&>div>header]:hidden [&>div>nav]:hidden [&>div]:pb-0"><DesignMyPage /></div></V2Layout>}
      </Route>
      <Route path="/v2/preview/documents">
        {() => <V2Layout preview><div className="[&>div>header]:hidden"><DesignDocuments /></div></V2Layout>}
      </Route>
      <Route path="/v2/preview/interested">
        {() => <V2Layout preview><div className="[&>div>header]:hidden [&>div>nav]:hidden"><DesignInterested /></div></V2Layout>}
      </Route>
      <Route path="/v2/preview/announcements">
        {() => <V2Layout preview><div className="[&>div>header]:hidden [&>div>nav]:hidden"><DesignAnnouncements /></div></V2Layout>}
      </Route>
      <Route path="/v2/preview/features">
        {() => <V2Layout preview><div className="[&>div>header]:hidden [&>div>nav]:hidden"><DesignFeatures /></div></V2Layout>}
      </Route>
      <Route path="/v2/preview/upload">
        {() => <V2Layout preview><div className="[&>div>header]:hidden [&_.max-w-3xl]:max-w-[1200px] lg:[&_footer]:left-60"><DesignUpload /></div></V2Layout>}
      </Route>
      <Route path="/v2/preview/simulation">
        {() => <V2Layout preview><div className="[&>div>header]:hidden"><DesignSimulation /></div></V2Layout>}
      </Route>
      <Route path="/v2/preview">{() => <V2PropertyList preview />}</Route>
      <Route path="/register/:token">{() => <Register />}</Route>
      <Route path="/view-ranking">
        {() => (
          <ManagementRoute>
            <ViewRanking />
          </ManagementRoute>
        )}
      </Route>
      <Route path="/forgot-password">{() => <ForgotPassword />}</Route>
      <Route path="/reset-password/:token">{() => <ResetPassword />}</Route>
      <Route path="/features">{() => <Features />}</Route>
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
              <Route path="/v2/properties">{() => <V2PropertyList />}</Route>
              <Route path="/v2">{() => { setLocation("/v2/properties"); return null; }}</Route>
              <Route path="/v2/property/:id">
                {() => <V2PropertyDetail />}
              </Route>
              <Route path="/v2/messages">{() => <V2Messages />}</Route>
              <Route path="/v2/favorites">
                {() => <V2PropertyList collection="favorites" />}
              </Route>
              <Route path="/v2/my-properties">
                {() => <V2PropertyList collection="mine" />}
              </Route>
              <Route path="/v2/mypage">{() => <V2MyPage />}</Route>
              <Route path="/v2/documents">{() => <V2Documents />}</Route>
              <Route path="/v2/interested">
                {() => <V2Layout><main className="mx-auto max-w-[1200px] p-4 pb-24 lg:p-7 lg:pb-10"><InterestedUsers v2 /></main></V2Layout>}
              </Route>
              <Route path="/v2/upload">
                {() => <V2Layout><main className="mx-auto max-w-[1400px] p-4 pb-24 lg:p-7 lg:pb-10"><div className="[&>div]:max-w-none [&_.rounded-lg]:rounded-none [&_.rounded-xl]:rounded-none"><PropertyUpload v2 /></div></main></V2Layout>}
              </Route>
              <Route path="/v2/announcements">
                {() => <V2Layout><main className="mx-auto max-w-[1200px] p-4 pb-24 lg:p-7 lg:pb-10"><div className="[&>div]:max-w-none [&_.rounded-lg]:rounded-none"><AnnounceArchive /></div></main></V2Layout>}
              </Route>
              <Route path="/v2/simulation/:id">
                {() => <V2Layout><main className="mx-auto max-w-[1200px] p-4 pb-24 lg:p-7 lg:pb-10"><div className="[&>div]:max-w-none [&_.rounded-lg]:rounded-none"><Simulation v2 /></div></main></V2Layout>}
              </Route>
              <Route path="/v2/chat/:partnerId/:propertyId">
                {() => <V2Chat />}
              </Route>
              <Route path="/v2/admin">{() => <AdminRoute v2 />}</Route>
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
                {() => (
                  <DashboardLayout>
                    <DirectMessage />
                  </DashboardLayout>
                )}
              </Route>
              <Route path="/dm/:id">
                {() => (
                  <DashboardLayout>
                    <DirectMessage />
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
              <Route path="/dm-list">
                {() => (
                  <DashboardLayout>
                    <ChatList />
                  </DashboardLayout>
                )}
              </Route>
              <Route path="/simulation/:id">
                {() => (
                  <DashboardLayout>
                    <Simulation />
                  </DashboardLayout>
                )}
              </Route>
              <Route path="/documents">
                {() => (
                  <DashboardLayout>
                    <DocumentList />
                  </DashboardLayout>
                )}
              </Route>
              <Route path="/buyer-preference">
                {() => (
                  <DashboardLayout>
                    <BuyerPreference />
                  </DashboardLayout>
                )}
              </Route>
              <Route path="/my-properties">
                {() => (
                  <DashboardLayout>
                    <PropertyList mode="mine" />
                  </DashboardLayout>
                )}
              </Route>
              <Route path="/favorites">
                {() => (
                  <DashboardLayout>
                    <Favorites />
                  </DashboardLayout>
                )}
              </Route>
              <Route path="/mypage">
                {() => (
                  <DashboardLayout>
                    <MyPage key="mypage" />
                  </DashboardLayout>
                )}
              </Route>
              <Route path="/interested">
                {() => (
                  <DashboardLayout>
                    <InterestedUsers />
                  </DashboardLayout>
                )}
              </Route>
              <Route path="/features">
                {() => (
                  <DashboardLayout>
                    <Features />
                  </DashboardLayout>
                )}
              </Route>
              <Route path="/announce-archive">
                {() => (
                  <DashboardLayout>
                    <AnnounceArchive />
                  </DashboardLayout>
                )}
              </Route>
              <Route path="/admin">{() => <AdminRoute v2 />}</Route>
              <Route path="/">
                {() => V2_DEFAULT ? (
                  <V2PropertyList />
                ) : (
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

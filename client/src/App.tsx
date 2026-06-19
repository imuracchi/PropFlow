import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Login from "./pages/Login";
import PropertyList from "./pages/PropertyList";
import PropertyDetail from "./pages/PropertyDetail";
import PropertyUpload from "./pages/PropertyUpload";
import ChatRoom from "./pages/ChatRoom";
import Admin from "./pages/Admin";

function AppContent() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
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
      <Route path="/chat/:id">
        {() => (
          <DashboardLayout>
            <ChatRoom />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/admin">
        {() => (
          <DashboardLayout>
            <Admin />
          </DashboardLayout>
        )}
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
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

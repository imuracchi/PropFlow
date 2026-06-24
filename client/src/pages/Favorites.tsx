import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, StickyNote } from "lucide-react";
import PropertyList from "./PropertyList";

export default function Favorites() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-foreground">お気に入り</h1>
      <Tabs defaultValue="favorites">
        <TabsList className="bg-muted">
          <TabsTrigger value="favorites" className="gap-1.5">
            <Heart className="w-3.5 h-3.5" />
            お気に入り
          </TabsTrigger>
          <TabsTrigger value="memo" className="gap-1.5">
            <StickyNote className="w-3.5 h-3.5" />
            メモした物件
          </TabsTrigger>
        </TabsList>
        <TabsContent value="favorites" className="mt-4">
          <PropertyList mode="favorites" hideHeader />
        </TabsContent>
        <TabsContent value="memo" className="mt-4">
          <PropertyList mode="memo" hideHeader />
        </TabsContent>
      </Tabs>
    </div>
  );
}

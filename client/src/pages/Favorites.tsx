import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Heart } from "lucide-react";
import PropertyList from "./PropertyList";

export default function Favorites() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-foreground">お気に入り</h1>

      <Tabs defaultValue="favorites">
        <TabsList className="bg-muted">
          <TabsTrigger value="favorites" className="gap-1.5">
            <Heart className="w-3.5 h-3.5" />
            お気に入り物件
          </TabsTrigger>
          <TabsTrigger value="mine" className="gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            登録済み物件
          </TabsTrigger>
        </TabsList>

        <TabsContent value="favorites" className="mt-4">
          <PropertyList mode="favorites" hideHeader />
        </TabsContent>

        <TabsContent value="mine" className="mt-4">
          <PropertyList mode="mine" hideHeader />
        </TabsContent>
      </Tabs>
    </div>
  );
}

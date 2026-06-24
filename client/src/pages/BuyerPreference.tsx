import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2, Target, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const PROPERTY_TYPES = ["土地", "一棟マンション", "区分マンション", "一棟アパート", "戸建", "事務所ビル", "店舗", "倉庫"];

export default function BuyerPreference() {
  const { data: pref, isLoading } = trpc.buyer.getPreference.useQuery();
  const saveMutation = trpc.buyer.savePreference.useMutation({
    onSuccess: () => toast.success("希望条件を保存しました"),
  });
  const utils = trpc.useUtils();

  const [areas, setAreas] = useState<string[]>([]);
  const [areaInput, setAreaInput] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minLandArea, setMinLandArea] = useState("");
  const [maxLandArea, setMaxLandArea] = useState("");
  const [stations, setStations] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (pref) {
      setAreas(pref.areas ?? []);
      setTypes(pref.types ?? []);
      setMinPrice(pref.minPrice ? String(pref.minPrice / 10000) : "");
      setMaxPrice(pref.maxPrice ? String(pref.maxPrice / 10000) : "");
      setMinLandArea(pref.minLandArea ? String(pref.minLandArea) : "");
      setMaxLandArea(pref.maxLandArea ? String(pref.maxLandArea) : "");
      setStations(pref.stations ?? "");
      setNotes(pref.notes ?? "");
    }
  }, [pref]);

  const addArea = () => {
    const newAreas = areaInput.split(/[、,]/).map(s => s.trim()).filter(s => s && !areas.includes(s));
    if (newAreas.length > 0) {
      setAreas([...areas, ...newAreas]);
    }
    setAreaInput("");
  };

  const toggleType = (t: string) => {
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleSave = async () => {
    await saveMutation.mutateAsync({
      areas: areas.length > 0 ? areas : null,
      types: types.length > 0 ? types : null,
      minPrice: minPrice ? Number(minPrice) * 10000 : null,
      maxPrice: maxPrice ? Number(maxPrice) * 10000 : null,
      minLandArea: minLandArea ? Number(minLandArea) : null,
      maxLandArea: maxLandArea ? Number(maxLandArea) : null,
      stations: stations || null,
      notes: notes || null,
    });
    utils.buyer.getPreference.invalidate();
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Target className="w-6 h-6 text-primary" />
          希望条件
        </h1>
        <p className="text-sm text-muted-foreground mt-1">希望条件を登録すると、物件一覧にマッチ率が表示されます</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-5">
        <div>
          <Label className="text-sm font-medium">希望エリア</Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              value={areaInput}
              onChange={e => setAreaInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addArea())}
              placeholder="例: 港区、渋谷区、目黒区"
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={addArea}>追加</Button>
          </div>
          {areas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {areas.map(a => (
                <span key={a} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                  {a}
                  <button onClick={() => setAreas(areas.filter(x => x !== a))} className="hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label className="text-sm font-medium">物件種別</Label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {PROPERTY_TYPES.map(t => (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  types.includes(t)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium">予算（万円）</Label>
          <div className="flex items-center gap-2 mt-1.5">
            <Input
              type="number"
              value={minPrice}
              onChange={e => setMinPrice(e.target.value)}
              placeholder="下限"
              className="flex-1"
            />
            <span className="text-muted-foreground">〜</span>
            <Input
              type="number"
              value={maxPrice}
              onChange={e => setMaxPrice(e.target.value)}
              placeholder="上限"
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground shrink-0">万円</span>
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium">土地面積（㎡）</Label>
          <div className="flex items-center gap-2 mt-1.5">
            <Input
              type="number"
              value={minLandArea}
              onChange={e => setMinLandArea(e.target.value)}
              placeholder="下限"
              className="flex-1"
            />
            <span className="text-muted-foreground">〜</span>
            <Input
              type="number"
              value={maxLandArea}
              onChange={e => setMaxLandArea(e.target.value)}
              placeholder="上限"
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground shrink-0">㎡</span>
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium">希望沿線・駅</Label>
          <Input
            value={stations}
            onChange={e => setStations(e.target.value)}
            placeholder="例: 東京メトロ銀座線、JR山手線 渋谷駅"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">その他の希望</Label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="例: 角地希望、駐車場2台分、南向き"
            rows={3}
            className="mt-1.5"
          />
        </div>

        <Button
          className="w-full gap-2"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存する
        </Button>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ChevronLeft, Send, Paperclip, Building2, Users,
  Home, MapPin, FileText, Bell, BellOff, Info
} from "lucide-react";
import { useLocation } from "wouter";

type Message = {
  id: number;
  sender: string;
  company: string;
  content: string;
  time: string;
  isMe: boolean;
  isSystem?: boolean;
  attachment?: string;
};

const mockMessages: Message[] = [
  {
    id: 1, sender: "システム", company: "", content: "「パークコート渋谷 3LDK」の専用チャットルームが作成されました。",
    time: "06/10 10:00", isMe: false, isSystem: true,
  },
  {
    id: 2, sender: "田中 健太", company: "株式会社〇〇不動産",
    content: "物件を登録しました。ご質問はこちらでお受けします。資料もご確認ください。",
    time: "06/10 10:05", isMe: false,
  },
  {
    id: 3, sender: "佐藤 誠", company: "△△リアルティ株式会社",
    content: "ご登録ありがとうございます。現在の入居者の契約期間はいつまでになりますか？",
    time: "06/10 11:20", isMe: false,
  },
  {
    id: 4, sender: "田中 健太", company: "株式会社〇〇不動産",
    content: "現在の賃貸借契約は2025年3月末までとなっています。更新の意向も確認中です。",
    time: "06/10 11:35", isMe: false,
  },
  {
    id: 5, sender: "山本 裕子", company: "□□不動産コンサルティング",
    content: "融資について確認させてください。どの金融機関での実績がありますか？",
    time: "06/10 14:00", isMe: false,
  },
  {
    id: 6, sender: "自分", company: "自社",
    content: "〇〇銀行と△△信用金庫での融資実績があります。詳細はお問い合わせください。",
    time: "06/10 14:15", isMe: true,
  },
  {
    id: 7, sender: "田中 健太", company: "株式会社〇〇不動産",
    content: "追加の図面資料をアップロードしました。ご確認ください。",
    time: "06/11 09:30", isMe: false,
    attachment: "間取り詳細図面_渋谷2丁目.pdf",
  },
];

const participants = [
  { name: "田中 健太", company: "株式会社〇〇不動産", initial: "田", isOwner: true },
  { name: "佐藤 誠", company: "△△リアルティ株式会社", initial: "佐", isOwner: false },
  { name: "山本 裕子", company: "□□不動産コンサルティング", initial: "山", isOwner: false },
  { name: "鈴木 大輔", company: "◇◇ホームズ", initial: "鈴", isOwner: false },
  { name: "自分", company: "自社", initial: "自", isOwner: false },
];

export default function ChatRoom() {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [input, setInput] = useState("");
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, {
      id: prev.length + 1,
      sender: "自分", company: "自社",
      content: input,
      time: "今",
      isMe: true,
    }]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-5xl mx-auto">
      {/* チャットヘッダー */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            onClick={() => setLocation("/property/1")}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 bg-primary/15 border border-primary/20 rounded-lg flex items-center justify-center shrink-0">
            <Home className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-foreground text-sm">パークコート渋谷 3LDK</h2>
              <span className="text-xs border font-medium px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                公開中
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              東京都渋谷区渋谷2丁目 ・ 8,500万円
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={`gap-1 text-xs bg-background border-border ${showParticipants ? "border-primary/40 bg-primary/5 text-primary" : ""}`}
            onClick={() => setShowParticipants(!showParticipants)}
          >
            <Users className="w-3.5 h-3.5" />
            {participants.length}名参加
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`gap-1 text-xs bg-background border-border ${notifyEnabled ? "text-primary border-primary/40 bg-primary/5" : ""}`}
            onClick={() => setNotifyEnabled(!notifyEnabled)}
          >
            {notifyEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            LINE通知
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs bg-background border-border"
            onClick={() => setLocation("/property/1")}
          >
            <Info className="w-3.5 h-3.5" />
            物件詳細
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden pt-4">
        {/* メッセージエリア */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {messages.map(msg => {
              if (msg.isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <span className="text-xs text-muted-foreground bg-muted border border-border px-3 py-1 rounded-full">
                      {msg.content}
                    </span>
                  </div>
                );
              }
              return (
                <div key={msg.id} className={`flex gap-3 ${msg.isMe ? "flex-row-reverse" : ""}`}>
                  <Avatar className="w-8 h-8 shrink-0 mt-1">
                    <AvatarFallback className={`text-xs font-bold ${msg.isMe ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {msg.sender.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`flex flex-col gap-1 max-w-[70%] ${msg.isMe ? "items-end" : "items-start"}`}>
                    {!msg.isMe && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{msg.sender}</span>
                        <span className="text-xs text-muted-foreground">{msg.company}</span>
                      </div>
                    )}
                    <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.isMe
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-card border border-border text-foreground rounded-tl-sm shadow-sm"
                    }`}>
                      {msg.content}
                      {msg.attachment && (
                        <div className={`mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                          msg.isMe ? "bg-primary-foreground/10" : "bg-muted border border-border"
                        }`}>
                          <FileText className="w-3.5 h-3.5 shrink-0" />
                          {msg.attachment}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{msg.time}</span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* 入力エリア */}
          <div className="pt-4 border-t border-border mt-4">
            <div className="flex items-end gap-2">
              <Button variant="outline" size="icon" className="shrink-0 h-10 w-10 bg-background border-border">
                <Paperclip className="w-4 h-4 text-muted-foreground" />
              </Button>
              <div className="flex-1">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="メッセージを入力..."
                  className="bg-background border-border"
                />
              </div>
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 h-10 w-10 shadow-md"
                size="icon"
                onClick={sendMessage}
                disabled={!input.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            {notifyEnabled && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Bell className="w-3 h-3 text-primary" />
                新着メッセージはLINEに通知されます
              </p>
            )}
          </div>
        </div>

        {/* 参加者パネル */}
        {showParticipants && (
          <div className="w-56 shrink-0">
            <div className="bg-card border border-border rounded-xl h-full overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">参加業者</p>
              </div>
              <div className="p-4 space-y-3">
                {participants.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Avatar className="w-7 h-7">
                      <AvatarFallback className={`text-xs font-bold ${p.isOwner ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {p.initial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.company}</p>
                    </div>
                    {p.isOwner && (
                      <span className="text-xs shrink-0 text-primary border border-primary/30 bg-primary/10 px-1.5 py-0.5 rounded-md">
                        登録
                      </span>
                    )}
                  </div>
                ))}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {participants.length}社が参加中
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

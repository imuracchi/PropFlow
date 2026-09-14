/**
 * PropFlow 物件問い合わせ自動返信
 *
 * 必須設定（Apps Scriptの「スクリプト プロパティ」）
 * PROPFLOW_GAS_INTEGRATION_SECRET: Railwayの同名環境変数と同じ値
 */

const SPREADSHEET_ID = '1EoVCCYitGGRf8b_bh0MUn7YQNewKoLo2aKEvbwm5d1I';
const SHEET_NAME = '問い合わせログ';
const PROCESSED_LABEL = 'auto-replied';
const NOTIFY_EMAIL = 'imuracchi@gmail.com';
const PROPFLOW_API_URL = 'https://propflow.jp/api/integrations/gas/public-property-document';
const PROPFLOW_INTRO_URL = 'https://propflow.jp/propflow-intro.html';
const REGISTRATION_URL = 'https://propflow.jp/registration-request';
const SUPPORT_NAME = 'PropFlowサポート';

const INQUIRY_CHANNELS = [
  { email: 'propflow01@gspec.me', source: 'LINE' },
  { email: 'propflow02@gspec.me', source: 'Facebook' },
  { email: 'property@gspec.me', source: '物件紹介' }
];

function checkAndReply() {
  const processedLabel = getOrCreateLabel(PROCESSED_LABEL);
  const addresses = INQUIRY_CHANNELS.map(channel => channel.email);
  const query = 'in:inbox {' + addresses.map(email => 'to:' + email).join(' ') + '} ' +
    addresses.map(email => '-from:' + email).join(' ') + ' -label:' + PROCESSED_LABEL;
  const sheet = getLogSheet();
  GmailApp.search(query, 0, 20).forEach(thread => {
    try {
      processThread(thread, sheet, processedLabel);
    } catch (error) {
      notifyProcessingError(thread, error);
    }
  });
}

function processThread(thread, sheet, processedLabel) {
  const messages = thread.getMessages();
  if (messages.length === 0 || messages.length > 1) {
    thread.addLabel(processedLabel);
    return;
  }

  const message = messages[0];
  const sender = getSenderInformation(message.getFrom());
  const subject = message.getSubject() || '';
  const receivedBody = message.getPlainBody() || '';
  const receivedAt = Utilities.formatDate(message.getDate(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  const channel = detectInquiryChannel(message);
  if (!channel) throw new Error('受信先アドレスを判定できませんでした');

  if (isSystemAddress(sender.email)) {
    appendLog(sheet, receivedAt, channel, sender, subject, false, '自動返信対象外', receivedBody,
      'システム送信元のため自動返信をスキップ');
    thread.addLabel(processedLabel);
    return;
  }

  if (subject.indexOf('名刺登録の申し込み') !== -1) {
    appendLog(sheet, receivedAt, channel, sender, subject, hasBusinessCardAttachment(message),
      'フォーム申込・要登録対応', receivedBody, '登録申請フォーム経由のため自動返信をスキップ');
    notifyAdministrator('登録申請フォームから申し込みが届きました。', receivedAt, channel, sender, subject, []);
    thread.addLabel(processedLabel);
    return;
  }

  const propertyIds = extractPropertyIds(subject + '\n' + receivedBody);
  if (propertyIds.length !== 1) {
    const reason = propertyIds.length === 0
      ? '物件番号を特定できませんでした。'
      : '複数の物件番号が記載されています。';
    appendLog(sheet, receivedAt, channel, sender, subject, hasBusinessCardAttachment(message),
      '要確認・自動返信なし', receivedBody, reason);
    notifyAdministrator(reason, receivedAt, channel, sender, subject, propertyIds);
    thread.addLabel(processedLabel);
    return;
  }

  const hasCard = hasBusinessCardAttachment(message);
  const document = issuePublicDocumentUrl(propertyIds[0], sender.email);
  const replyBody = hasCard
    ? buildCardReply(sender.name, document)
    : buildNoCardReply(sender.name, document);

  message.reply(replyBody, {
    from: channel.email,
    replyTo: channel.email,
    name: SUPPORT_NAME
  });
  appendLog(sheet, receivedAt, channel, sender, subject, hasCard, '資料URL自動返信済み', receivedBody, replyBody);
  if (hasCard) {
    notifyAdministrator('名刺付きの物件問い合わせです。', receivedAt, channel, sender, subject, propertyIds);
  }
  thread.addLabel(processedLabel);
}

function issuePublicDocumentUrl(propertyId, email) {
  const secret = PropertiesService.getScriptProperties()
    .getProperty('PROPFLOW_GAS_INTEGRATION_SECRET');
  if (!secret) throw new Error('スクリプト プロパティに連携用秘密キーが設定されていません');

  const response = UrlFetchApp.fetch(PROPFLOW_API_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-PropFlow-Integration-Key': secret },
    payload: JSON.stringify({ propertyId: propertyId, email: email }),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  const text = response.getContentText();
  let body = {};
  try { body = JSON.parse(text); } catch (ignoredError) {}
  if (status !== 200 || !body.downloadUrl) {
    throw new Error('PF-' + propertyId + 'の資料URLを発行できませんでした（HTTP ' + status + '）：' + (body.error || text));
  }
  return body;
}

function extractPropertyIds(text) {
  const normalized = String(text || '')
    .replace(/[Ｐｐ]/g, 'P')
    .replace(/[Ｆｆ]/g, 'F')
    .replace(/[０-９]/g, value => String.fromCharCode(value.charCodeAt(0) - 0xFEE0));
  const ids = [];
  const pattern = /PF[\s\-ー−‐‑–—―_]*([0-9]+)/gi;
  let match;
  while ((match = pattern.exec(normalized)) !== null) {
    const id = Number(match[1]);
    if (id > 0 && ids.indexOf(id) === -1) ids.push(id);
  }
  return ids;
}

function buildCardReply(name, document) {
  return buildGreeting(name) +
    'このたびは、お名刺をお送りいただきありがとうございます。\n\n' +
    buildDocumentGuide(document) + '\n\n' +
    buildPropFlowGuide() + '\n\n' +
    'PropFlowへの登録は無料です。\n\n' +
    '登録をご希望の場合は、お送りいただいた名刺を使って登録手続きを進めますので、このメールに「登録希望」とご返信ください。\n\n' +
    SUPPORT_NAME;
}

function buildNoCardReply(name, document) {
  return buildGreeting(name) +
    'このたびは、物件についてお問い合わせいただきありがとうございます。\n\n' +
    buildDocumentGuide(document) + '\n\n' +
    buildPropFlowGuide() + '\n\n' +
    'PropFlowへの登録は無料です。\n\n' +
    '登録をご希望の場合は、このメールへの返信にお名刺の画像を添付し、「登録希望」とお送りください。お送りいただいた名刺情報を使って登録手続きを進めます。\n\n' +
    'ご自身で登録申請を行う場合は、以下のページをご利用ください。\n\n' +
    '▼無料登録を申請する\n' + REGISTRATION_URL + '\n\n' +
    SUPPORT_NAME;
}

function buildGreeting(name) {
  return name ? name + '様\n\n' : '';
}

function buildDocumentGuide(document) {
  return 'お問い合わせいただいた物件\n' +
    '物件番号：PF-' + document.propertyId + '\n' +
    '物件名：' + document.propertyName + '\n\n' +
    '一般公開用の物件概要書を、以下の専用URLからダウンロードいただけます。\n\n' +
    '▼物件概要書をダウンロード\n' + document.downloadUrl + '\n\n' +
    'URLの有効期限は発行から3日間です。\n\n' +
    '本資料では、掲載会社名・担当者情報・丁目・番地などの詳細住所を非表示にしています。' +
    '物件情報の内容・最新性・取引条件については、物件登録者へご確認ください。';
}

function buildPropFlowGuide() {
  return 'PropFlowは、G-Spec合同会社が運営する、不動産事業者向けの物件情報共有プラットフォームです。' +
    '物件の詳しい情報や関連資料の確認、物件登録者への問い合わせができます。\n\n' +
    '▼PropFlowのご案内\n' + PROPFLOW_INTRO_URL;
}

function detectInquiryChannel(message) {
  const recipients = ((message.getTo() || '') + ',' + (message.getCc() || '')).toLowerCase();
  return INQUIRY_CHANNELS.find(channel => recipients.indexOf(channel.email.toLowerCase()) !== -1) || null;
}

function hasBusinessCardAttachment(message) {
  return message.getAttachments({ includeInlineImages: true, includeAttachments: true }).some(attachment => {
    const name = (attachment.getName() || '').toLowerCase();
    const type = (attachment.getContentType() || '').toLowerCase();
    const size = attachment.getSize();
    const image = type.indexOf('image/') === 0 || /\.(jpg|jpeg|jfif|png|heic|heif|webp|avif)$/i.test(name);
    const pdf = type === 'application/pdf' || /\.pdf$/i.test(name);
    if ((!image && !pdf) || size <= 0) return false;
    if (image && /(logo|signature|icon|spacer|banner|pixel|image00|facebook|instagram|linkedin|twitter|x-logo)/i.test(name) && size < 200000) return false;
    return !(image && !name && size < 15000);
  });
}

function getSenderInformation(fromText) {
  const value = fromText || '';
  const match = value.match(/<([^>]+)>/);
  return {
    email: (match ? match[1] : value).trim(),
    name: match ? value.substring(0, match.index).replace(/^["']|["']$/g, '').trim() : ''
  };
}

function isSystemAddress(email) {
  const value = (email || '').toLowerCase();
  return ['no-reply', 'noreply', 'do-not-reply', 'mailer-daemon', 'postmaster']
    .some(word => value.indexOf(word) !== -1);
}

function notifyAdministrator(reason, receivedAt, channel, sender, subject, propertyIds) {
  GmailApp.sendEmail(NOTIFY_EMAIL, '【要確認】物件問い合わせ：' + (sender.name || sender.email),
    reason + '\n\n流入元：' + channel.source +
    '\n物件番号：' + (propertyIds.length ? propertyIds.map(id => 'PF-' + id).join('、') : '記載なし') +
    '\n送信者名：' + (sender.name || '不明') +
    '\nメールアドレス：' + sender.email +
    '\n受信日時：' + receivedAt + '\n件名：' + subject,
    { name: SUPPORT_NAME });
}

function notifyProcessingError(thread, error) {
  let subject = '取得できませんでした';
  try {
    const messages = thread.getMessages();
    if (messages.length) subject = messages[0].getSubject();
  } catch (ignoredError) {}
  GmailApp.sendEmail(NOTIFY_EMAIL, '【PropFlow GASエラー】自動返信処理に失敗しました',
    '対象件名：' + subject + '\n\nエラー内容：\n' + (error && error.stack ? error.stack : String(error)),
    { name: SUPPORT_NAME });
}

function getLogSheet() {
  const book = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = book.insertSheet(SHEET_NAME);
  const headers = ['受信日時', '流入元', '受信アドレス', '送信者名', '送信者メール', '件名', '名刺添付', '処理状況', '受信本文', '返信本文'];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendLog(sheet, receivedAt, channel, sender, subject, hasCard, status, receivedBody, replyBody) {
  sheet.appendRow([
    sheetSafe(receivedAt), sheetSafe(channel.source), sheetSafe(channel.email), sheetSafe(sender.name),
    sheetSafe(sender.email), sheetSafe(subject), hasCard ? 'あり' : 'なし', sheetSafe(status),
    sheetSafe(truncateText(receivedBody, 10000)), sheetSafe(truncateText(replyBody, 10000))
  ]);
}

function sheetSafe(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function truncateText(value, maxLength) {
  const text = value || '';
  return text.length <= maxLength ? text : text.substring(0, maxLength) + '\n…省略';
}

function getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function previewReplyBodies() {
  const sample = {
    propertyId: 123,
    propertyName: 'テスト物件',
    downloadUrl: 'https://propflow.jp/public/document/TEST'
  };
  Logger.log('===== 名刺あり =====\n\n' + buildCardReply('テスト', sample));
  Logger.log('===== 名刺なし =====\n\n' + buildNoCardReply('テスト', sample));
}

function testPropertyNumberExtraction() {
  const actual = extractPropertyIds('PFー123／ＰＦ－１２４／pf 125');
  if (actual.join(',') !== '123,124,125') throw new Error('物件番号抽出テスト失敗：' + actual.join(','));
  Logger.log('物件番号抽出テストOK');
}

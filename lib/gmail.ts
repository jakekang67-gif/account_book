/** Gmail API raw 메시지용 URL-safe base64 */
export function toBase64Url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/** 엑셀 첨부가 포함된 간단한 MIME 메일 원문 생성 */
export function buildExcelMailRaw(options: {
  from: string;
  to: string;
  subject: string;
  bodyText: string;
  fileName: string;
  fileBase64: string;
}) {
  const boundary = `boundary_${Date.now()}`;
  const lines = [
    `From: ${options.from}`,
    `To: ${options.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(options.subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    options.bodyText,
    "",
    `--${boundary}`,
    `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; name="${options.fileName}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${options.fileName}"`,
    "",
    options.fileBase64,
    "",
    `--${boundary}--`,
    "",
  ];

  return toBase64Url(lines.join("\r\n"));
}

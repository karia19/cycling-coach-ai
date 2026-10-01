export function formatErrorMessage(err: any, fallback: string = "An error occurred"): string {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err.detail) {
    if (typeof err.detail === "string") return err.detail;
    if (Array.isArray(err.detail)) {
      return err.detail
        .map((item: any) => (typeof item === "string" ? item : (item.msg || item.message || JSON.stringify(item))))
        .join(", ");
    }
    if (typeof err.detail === "object") {
      return err.detail.msg || err.detail.message || JSON.stringify(err.detail);
    }
  }
  if (Array.isArray(err)) {
    return err
      .map((item: any) => (typeof item === "string" ? item : (item.msg || item.message || JSON.stringify(item))))
      .join(", ");
  }
  if (typeof err === "object") {
    return err.msg || err.message || JSON.stringify(err);
  }
  return String(err);
}

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LoadingSkeleton, PageHeader } from "../../../components/ui";
import { services } from "../../../services/serviceProvider";
import { WhatsAppSettingsForm } from "../components/WhatsAppSettingsForm";
import { WhatsAppStatusBadge } from "../components/WhatsAppStatusBadge";
import type { WhatsAppBookingSettings as Settings } from "../types";

export default function WhatsAppBookingSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    void services.whatsapp
      .getSettings()
      .then((next) => { if (mounted) setSettings(next); })
      .catch((error) => { if (mounted) toast.error(error instanceof Error ? error.message : "Unable to load WhatsApp settings."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const save = async (next: Settings) => {
    setSaving(true);
    try {
      setSettings(await services.whatsapp.updateSettings(next));
      toast.success("WhatsApp settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save WhatsApp settings.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-6">
    <PageHeader title="WhatsApp Booking Settings" description="Clinic-level WhatsApp booking configuration, stored with the clinic record." action={settings ? <WhatsAppStatusBadge status={settings.apiStatus === "connected" ? "connected" : "demo"} /> : null} />
    {loading || !settings ? <LoadingSkeleton rows={4} /> : <WhatsAppSettingsForm settings={settings} saving={saving} onSave={(next) => void save(next)} />}
  </div>;
}

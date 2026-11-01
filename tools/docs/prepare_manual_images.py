"""Copies the walkthrough screenshots into docs/manual-test-images/ as compact JPEGs.

Source screenshots come from the QA runs (Playwright). Edit MAP to add a picture.
Usage: python tools/docs/prepare_manual_images.py <screenshots_dir>
"""
import os
import sys

from PIL import Image

SRC = sys.argv[1]
DST = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "manual-test-images")
os.makedirs(DST, exist_ok=True)

# name -> (source file, optional crop height in source pixels)
MAP = {
    "landing": ("d2_public_home.png", None), "clinic-list": ("d2_public_book.png", None),
    "clinic-page": ("m_clinic_page.png", None), "phone-clinic": ("m_phone_clinic.png", None),
    "flow1": ("m_flow1_doctor.png", None), "flow2": ("m_flow2_service.png", None), "flow3": ("m_flow3_datetime.png", None),
    "flow4-errors": ("m_flow4_errors.png", None), "flow4": ("m_flow4_details.png", None), "flow5": ("m_flow5_confirm.png", None),
    "success": ("m_success.png", None), "lookup": ("d2_public_bookingstatus.png", None), "lookup-result": ("m_lookup_result.png", None),
    "login": ("d2_public_login.png", None), "access-denied": ("m_access_denied.png", None),
    "sa-dashboard": ("dump_super_admin_super_admin_dashboard.png", None), "sa-subscriptions": ("dump_super_admin_super_admin_subscriptions.png", None),
    "sa-usage": ("dump_super_admin_super_admin_usage.png", None), "sa-support": ("dump_super_admin_super_admin_support.png", None),
    "sa-settings": ("dump_super_admin_super_admin_settings.png", None), "monitoring": ("dump_owner.jayanagar_monitoring.png", None),
    "owner-dashboard": ("dump_owner.jayanagar_owner_dashboard.png", None), "owner-staff": ("dump_owner.jayanagar_owner_staff.png", None),
    "add-staff": ("m_add_staff.png", None), "switcher": ("m_switcher.png", None), "owner-settings": ("dump_owner.jayanagar_owner_settings.png", None),
    "appointments": ("dump_reception_reception_appointments.png", None), "add-appointment": ("d2_add_appt.png", None),
    "new-patient": ("dump_reception_reception_new_patient.png", None), "reception-dashboard": ("dump_reception_reception_dashboard.png", None),
    "queue": ("dump_reception_reception_queue.png", None), "reception-billing": ("dump_reception_reception_billing.png", None),
    "doctor-queue": ("dump_doctor_doctor_queue.png", None), "availability": ("dump_doctor_doctor_availability.png", None),
    "block-date": ("m_block_date.png", None), "follow-ups": ("dump_doctor_doctor_follow_ups.png", None), "reminders": ("dump_doctor_doctor_patient_reminders.png", None),
    "consultation": ("j7_consult.png", 1050), "prescription": ("j9_rx_filled.png", 1050),
    "pharmacy-dashboard": ("dump_pharmacist_pharmacy_dashboard.png", None), "pharmacy-queue": ("dump_pharmacist_pharmacy_prescriptions.png", None),
    "dispense": ("j14_detail.png", 1000), "stock": ("dump_pharmacist_pharmacy_stock.png", None), "add-stock": ("dump_pharmacist_pharmacy_add_stock.png", None),
    "counter-billing": ("dump_pharmacist_pharmacy_billing.png", None), "low-stock": ("dump_pharmacist_pharmacy_low_stock.png", None), "expiry": ("dump_pharmacist_pharmacy_expiry_alerts.png", None),
    "billing-dashboard": ("dump_owner.jayanagar_billing_dashboard.png", None), "create-bill": ("dump_owner.jayanagar_billing_create.png", None),
    "invoices": ("dump_owner.jayanagar_billing_invoices.png", None), "receipts": ("dump_owner.jayanagar_billing_receipts.png", None),
    "pending": ("dump_owner.jayanagar_billing_pending_payments.png", None), "record-payment": ("j16_modal.png", None),
    "refunds": ("dump_owner.jayanagar_billing_refunds.png", None), "reports": ("dump_owner.jayanagar_billing_reports.png", None),
    "wa-dashboard": ("dump_owner.jayanagar_whatsapp_booking_dashboard.png", None), "wa-simulator": ("dump_owner.jayanagar_whatsapp_booking_simulator.png", None),
    "wa-templates": ("dump_owner.jayanagar_whatsapp_booking_templates.png", None), "wa-conversations": ("dump_owner.jayanagar_whatsapp_booking_conversations.png", None),
    "wa-settings": ("dump_owner.jayanagar_whatsapp_booking_settings.png", None),
}
total = 0
for name, (file, crop) in MAP.items():
    path = os.path.join(SRC, file)
    if not os.path.exists(path):
        print("MISSING", file)
        continue
    img = Image.open(path).convert("RGB")
    if crop:
        img = img.crop((0, 0, img.width, min(crop, img.height)))
    if img.width > 1100:
        img = img.resize((1100, round(img.height * 1100 / img.width)), Image.LANCZOS)
    out = os.path.join(DST, name + ".jpg")
    img.save(out, "JPEG", quality=80, optimize=True)
    total += os.path.getsize(out)
print(f"{len(MAP)} images, {total / 1024 / 1024:.1f} MB")

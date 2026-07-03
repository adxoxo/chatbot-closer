"""Seed two demo tenants so the system is demonstrable immediately.

Run:  python seed.py
Idempotent-ish: skips creation if a tenant with the same name already exists.
"""
from models.schemas import DEFAULT_WEIGHTS
from services.supabase import store

TENANTS = [
    {
        "name": "TechQuarters",
        "system_prompt": (
            "You are the sales closer for TechQuarters, a digital marketing agency that "
            "specializes in lead generation, paid media (Google & Meta Ads), and conversion "
            "rate optimization for businesses already spending on marketing. You are confident, "
            "concise, and consultative. Your job is to quickly find out if the visitor runs a "
            "real business with real ad spend and a real, costly problem — and if so, move them "
            "to booking a strategy call. You never act like a support bot."
        ),
        "knowledge_base": (
            "TechQuarters services:\n"
            "- Paid Media Management: Google Ads, Meta Ads, LinkedIn Ads. Minimum engagement "
            "$3k/mo management for accounts spending $10k+/mo.\n"
            "- Lead Generation Funnels: landing pages, offer design, CRM automation.\n"
            "- Conversion Rate Optimization: audits, A/B testing, analytics.\n"
            "Ideal client: established business spending at least $10k/mo on ads OR doing "
            "$50k+/mo revenue with proven demand.\n"
            "We do NOT do one-off projects under $2k or work with pre-revenue startups."
        ),
        "calendly_url": "https://calendly.com/techquarters/strategy-call",
        "scoring_weights": dict(DEFAULT_WEIGHTS),
        "hot_threshold": 12.0,
        "warm_threshold": 6.0,
        "branding": {
            "primary_color": "#c4c0ff",
            "bot_name": "TQ Assistant",
            "logo_url": "",
            "welcome_message": "Hi! I'm the TQ Assistant. What does your business do, and what's the biggest growth gap right now?",
        },
        "notification_email": "alerts@techquarters.example",
        "n8n_webhook_url": "",
        "is_active": True,
    },
    {
        "name": "Acme Cloud (SaaS)",
        "system_prompt": (
            "You are the Acme Cloud Concierge, an AI closer for a B2B SaaS company selling "
            "real-time database sync and workflow automation. Qualify visitors by company size, "
            "current tooling, and migration timeline. Push qualified enterprise leads to book a "
            "demo. Be precise and technical but warm."
        ),
        "knowledge_base": (
            "Acme Cloud products:\n"
            "1. Cloud Sync — real-time DB mirroring across AWS/GCP/Azure. From $499/mo.\n"
            "2. Flow — visual workflow automation, 200+ connectors.\n"
            "3. Shield — SOC2 security layer.\n"
            "Enterprise tier handles 500+ seats with a dedicated onboarding specialist.\n"
            "Do not mention competitors. Do not quote custom pricing without qualification."
        ),
        "calendly_url": "https://calendly.com/acme-cloud/demo",
        "scoring_weights": {**DEFAULT_WEIGHTS, "weight_bs": 1.5, "weight_da": 2.0},
        "hot_threshold": 12.0,
        "warm_threshold": 6.0,
        "branding": {
            "primary_color": "#68dbae",
            "bot_name": "Acme Concierge",
            "logo_url": "",
            "welcome_message": "Hello! I'm the Acme Concierge. How can I help you scale your infrastructure today?",
        },
        "notification_email": "sales@acme.example",
        "n8n_webhook_url": "",
        "is_active": True,
    },
]


def main():
    existing = {t["name"] for t in store.list_tenants()}
    for t in TENANTS:
        if t["name"] in existing:
            print(f"• skip (exists): {t['name']}")
            continue
        created = store.create_tenant(t)
        print(f"✓ created: {created['name']}  id={created['id']}")
    print("\nAll tenants:")
    for t in store.list_tenants():
        print(f"  {t['id']}  {t['name']}  active={t.get('is_active')}")


if __name__ == "__main__":
    main()

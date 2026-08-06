// ─────────────────────────────────────────────────────────────
// KUDICALL MESSAGE TEMPLATES
// Used by Clawbot to pitch vendors on WhatsApp
// ─────────────────────────────────────────────────────────────

const KUDICALL_LINK = process.env.KUDICALL_LINK || "https://kudicall.com";

/**
 * Build the main pitch message, personalised with vendor data.
 * @param {string|null} name     - Vendor's name (or null if unknown)
 * @param {string|null} product  - Product they're selling (from their listing)
 * @returns {string}
 */
export function buildPitchMessage(name, product) {
    const greeting = name ? `Hello ${name} 👋,` : `Hello there 👋,`;
    const productLine = product
        ? `I came across your listing for *"${product}"* and I'd love to share something that could really boost your sales. 🚀`
        : `I came across your listing and I'd love to share something that could really boost your sales. 🚀`;

    return `${greeting}

My name is Aloy, reaching out on behalf of *Kudicall*.

${productLine}

*Kudicall* is Nigeria's newest marketplace — think of it as WhatsApp and an online store combined into one powerful platform. You can list your products, chat directly with buyers, and close deals faster than anywhere else.

We are currently onboarding top sellers *for FREE* — and you are one of the people we hand-picked! 🎯

We are sending you the link to get started right away 👇`;
}

/**
 * The follow-up link message, sent a few seconds after the pitch.
 * @returns {string}
 */
export function buildLinkMessage() {
    return `🔗 ${KUDICALL_LINK}

Feel free to explore and sign up — it's completely free!
If you have any questions, just reply here. 😊

— *Team Kudicall*`;
}

export default { buildPitchMessage, buildLinkMessage, KUDICALL_LINK };

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 20px", lineHeight: "1.6", color: "#333" }}>
      <h1 style={{ fontSize: "2.2rem", marginBottom: "30px", color: "#111" }}>Privacy Policy</h1>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#222" }}>1. Overview</h2>
        <p>
          ShopMate AI ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how
          we collect, use, and protect your information when you use our Shopify app.
        </p>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#222" }}>2. Information We Collect</h2>
        <p>When you install ShopMate AI, we collect:</p>
        <ul style={{ marginLeft: "20px", marginTop: "10px" }}>
          <li>Your Shopify store name and domain</li>
          <li>Product catalog data (names, descriptions, prices)</li>
          <li>Order information needed to answer customer questions</li>
          <li>Customer policy and FAQ data you provide</li>
          <li>Chat conversation data for analytics and improvement</li>
        </ul>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#222" }}>3. How We Use Your Data</h2>
        <p>We use your data to:</p>
        <ul style={{ marginLeft: "20px", marginTop: "10px" }}>
          <li>Power the AI chatbot on your store</li>
          <li>Track deflection metrics and revenue attribution</li>
          <li>Improve the App's accuracy and features</li>
          <li>Send technical support and billing communications</li>
        </ul>
        <p style={{ marginTop: "10px" }}>
          We do <strong>not</strong> sell your data to third parties.
        </p>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#222" }}>4. Data Security</h2>
        <p>
          We use industry-standard encryption and security measures to protect your data. However, no method is 100%
          secure. If you have concerns, contact us immediately.
        </p>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#222" }}>5. Third-Party Services</h2>
        <p>
          We use Shopify's OAuth system to securely access your store. We may also use third-party analytics tools to
          understand App usage. These services have their own privacy policies.
        </p>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#222" }}>6. Data Retention</h2>
        <p>
          We retain your data while your App is installed. If you uninstall the App, we will delete your data within 30
          days, except where required by law.
        </p>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#222" }}>7. Your Rights</h2>
        <p>You have the right to:</p>
        <ul style={{ marginLeft: "20px", marginTop: "10px" }}>
          <li>Request a copy of your data</li>
          <li>Request deletion of your data</li>
          <li>Opt out of analytics tracking</li>
          <li>Uninstall the App at any time</li>
        </ul>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#222" }}>8. Children's Privacy</h2>
        <p>
          ShopMate AI is not intended for use by children under 13. We do not knowingly collect information from children.
        </p>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#222" }}>9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy at any time. Changes become effective when posted. Continued use of the App
          means you accept the updated policy.
        </p>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#222" }}>10. Contact Us</h2>
        <p>
          If you have questions about your privacy or this policy, contact us at{" "}
          <a href="mailto:admin@stackedboost.com" style={{ color: "#16a34a" }}>
            admin@stackedboost.com
          </a>
        </p>
      </section>

      <p style={{ color: "#6b7280", fontSize: "0.9rem", marginTop: "50px" }}>Last updated: March 2026</p>
    </div>
  );
}

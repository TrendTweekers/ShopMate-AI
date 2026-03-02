export default function TermsPage() {
  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 20px", lineHeight: "1.6", color: "#333" }}>
      <h1 style={{ fontSize: "2.2rem", marginBottom: "30px", color: "#111" }}>Terms of Service</h1>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#222" }}>1. Acceptance of Terms</h2>
        <p>
          By installing ShopMate AI ("the App") on your Shopify store, you agree to these Terms of Service. If you do
          not agree, please do not install the App.
        </p>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#222" }}>2. Use License</h2>
        <p>
          ShopMate grants you a limited, non-exclusive license to use the App on your Shopify store. You agree to:
        </p>
        <ul style={{ marginLeft: "20px", marginTop: "10px" }}>
          <li>Not reverse engineer or attempt to extract the App's source code</li>
          <li>Not use the App for any illegal or unauthorized purpose</li>
          <li>Not interfere with or disrupt the App's operation or other merchants' use</li>
        </ul>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#222" }}>3. Shopify Data Access</h2>
        <p>
          The App accesses your Shopify store data (products, orders, customers) only to provide chat functionality. We
          do not sell your data to third parties.
        </p>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#222" }}>4. Limitations of Liability</h2>
        <p>
          ShopMate AI is provided "as-is." We are not liable for any indirect, incidental, or consequential damages
          arising from your use of the App.
        </p>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#222" }}>5. Termination</h2>
        <p>
          You may uninstall the App at any time. We reserve the right to terminate access if you violate these Terms.
        </p>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#222" }}>6. Changes to Terms</h2>
        <p>We may update these Terms at any time. Continued use of the App constitutes acceptance of changes.</p>
      </section>

      <section style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "15px", color: "#222" }}>7. Contact</h2>
        <p>
          For questions about these Terms, contact us at{" "}
          <a href="mailto:admin@stackedboost.com" style={{ color: "#16a34a" }}>
            admin@stackedboost.com
          </a>
        </p>
      </section>

      <p style={{ color: "#6b7280", fontSize: "0.9rem", marginTop: "50px" }}>Last updated: March 2026</p>
    </div>
  );
}

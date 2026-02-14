"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), {
  ssr: false,
  loading: () => (
    <div className="swagger-loading">
      <p>Loading API documentation…</p>
    </div>
  ),
});

export default function ApiDocsPage() {
  return (
    <section className="swagger-container">
      <SwaggerUI url="/api/docs" />
    </section>
  );
}

import React from "react";

export default function BinderScreen() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>Binder</h1>
      <p>This is the Binder screen. You can connect devices, tokens, or workflows here.</p>

      <div style={{
        marginTop: "2rem",
        padding: "1rem",
        border: "1px solid #ccc",
        borderRadius: "8px",
        background: "#fafafa"
      }}>
        <h2>Binder Placeholder</h2>
        <p>Add your binding logic here when you're ready.</p>
      </div>
    </div>
  );
}

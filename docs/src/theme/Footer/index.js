import React from 'react';

const footerStyle = {
  borderTop: '1px solid #2a2a2a',
  background: '#000000',
  padding: '48px 24px',
  fontFamily: "'Space Grotesk', sans-serif",
};

const containerStyle = {
  maxWidth: '72rem',
  margin: '0 auto',
};

const topStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '32px',
  flexWrap: 'wrap',
};

const brandStyle = {
  maxWidth: '20rem',
};

const logoRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const brandNameStyle = {
  fontSize: '1.25rem',
  fontWeight: 700,
  color: '#acf901',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const taglineStyle = {
  marginTop: '8px',
  fontSize: '0.875rem',
  color: '#888888',
  lineHeight: 1.5,
};

const columnsStyle = {
  display: 'flex',
  gap: '40px',
  fontSize: '0.875rem',
  color: '#888888',
};

const columnStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const columnTitleStyle = {
  fontWeight: 600,
  color: 'rgba(172, 249, 1, 0.7)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontSize: '0.75rem',
  margin: '0 0 4px 0',
};

const linkStyle = {
  color: '#888888',
  textDecoration: 'none',
};

const bottomStyle = {
  marginTop: '40px',
  borderTop: '1px solid #2a2a2a',
  paddingTop: '24px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '8px',
};

const smallTextStyle = {
  fontSize: '0.75rem',
  color: '#444444',
  margin: 0,
};

export default function Footer() {
  return (
    <footer style={footerStyle}>
      <div style={containerStyle}>
        <div style={topStyle}>
          <div style={brandStyle}>
            <div style={logoRowStyle}>
              <img src="/img/logo.png" alt="Shroud Network" width={32} height={32} style={{ borderRadius: '2px' }} />
              <span style={brandNameStyle}>Shroud Network</span>
            </div>
            <p style={taglineStyle}>
              Privacy redefined with zero-knowledge on permissionless ledgers.
            </p>
          </div>

          <div style={columnsStyle}>
            <div style={columnStyle}>
              <p style={columnTitleStyle}>Protocol</p>
              <a href="/" style={linkStyle} className="footer-custom-link">Docs</a>
              <a href="https://testnet.snowtrace.io" target="_blank" rel="noopener noreferrer" style={linkStyle} className="footer-custom-link">Explorer</a>
            </div>
            <div style={columnStyle}>
              <p style={columnTitleStyle}>Community</p>
              <a href="https://x.com/shroudnetwork" target="_blank" rel="noopener noreferrer" style={linkStyle} className="footer-custom-link">Twitter</a>
              <a href="https://t.me/+CQMq831HnFo2ZDRl" target="_blank" rel="noopener noreferrer" style={linkStyle} className="footer-custom-link">Telegram</a>
            </div>
          </div>
        </div>

        <div style={bottomStyle}>
          <p style={smallTextStyle}>
            &copy; {new Date().getFullYear()} Shroud Network. All rights reserved.
          </p>
          <p style={smallTextStyle}>
            Built on <span style={{ color: 'rgba(172, 249, 1, 0.6)' }}>Avalanche</span> &middot; Powered by ZK-SNARKs
          </p>
        </div>
      </div>
    </footer>
  );
}

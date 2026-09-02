import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface FooterProps {
  logo: ReactNode;
  brandName: string;
  socialLinks: Array<{ icon: ReactNode; href: string; label: string }>;
  mainLinks: Array<{ href: string; label: string }>;
  legalLinks: Array<{ href: string; label: string }>;
  copyright: { text: string; license?: string };
  onMainLink?: (href: string) => void;
  onLegalLink?: (href: string) => void;
}

export function Footer({ logo, brandName, socialLinks, mainLinks, legalLinks, copyright, onMainLink, onLegalLink }: FooterProps) {
  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div className="footer-top">
          <button type="button" className="footer-brand" aria-label={brandName} onClick={() => onMainLink?.('#dashboard')}>
            {logo}
            <span>{brandName}</span>
          </button>
          <ul className="footer-social">
            {socialLinks.map((link) => (
              <li key={link.label}>
                <Button variant="secondary" size="icon" className="footer-social-button" asChild>
                  <a href={link.href} target="_blank" rel="noreferrer" aria-label={link.label}>{link.icon}</a>
                </Button>
              </li>
            ))}
          </ul>
        </div>
        <div className="footer-bottom">
          <nav>
            <ul className="footer-links">
              {mainLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} onClick={(event) => { event.preventDefault(); onMainLink?.(link.href); }}>{link.label}</a>
                </li>
              ))}
            </ul>
            <ul className="footer-links footer-legal-links">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} onClick={(event) => { event.preventDefault(); onLegalLink?.(link.href); }}>{link.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="footer-copyright">
            <div>{copyright.text}</div>
            {copyright.license && <div>{copyright.license}</div>}
          </div>
        </div>
      </div>
    </footer>
  );
}

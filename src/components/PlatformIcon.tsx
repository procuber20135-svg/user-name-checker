import React from 'react';
import { PlatformId } from '../utils/gamertagEngine';

export interface PlatformIconProps {
  platform: PlatformId | string;
  size?: number;
  className?: string;
}

export function XboxIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.156c2.41 0 4.622.863 6.353 2.302-1.685 1.573-4.148 3.738-6.353 6.64-2.205-2.902-4.668-5.067-6.353-6.64C7.378 3.02 9.59 2.156 12 2.156zm-7.66 3.52c1.776 1.624 4.347 3.87 6.613 6.942-2.914 4.22-6.574 6.786-8.547 7.828A9.794 9.794 0 0 1 2.156 12c0-2.392.859-4.59 2.184-6.324zm15.32 0c1.325 1.734 2.184 3.932 2.184 6.324 0 3.328-1.657 6.27-4.194 8.016-1.973-1.042-5.633-3.608-8.547-7.828 2.266-3.072 4.837-5.318 6.613-6.942.846.678 1.644 1.402 2.38 2.156-.473.473-.974.918-1.5 1.332.394.492.83.95 1.303 1.364.673-.527 1.306-1.107 1.89-1.734-.044-.24-.09-.475-.129-.688zm-3.072 13.988c-1.396.737-2.96 1.18-4.588 1.18-1.628 0-3.192-.443-4.588-1.18 1.745-1.077 4.542-3.21 4.588-5.32.046 2.11 2.843 4.243 4.588 5.32z" />
    </svg>
  );
}

export function MinecraftIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      {/* Top grass surface */}
      <polygon points="12,2 22,7.5 12,13 2,7.5" fill="#588527" />
      <polygon points="12,2 17,4.75 12,7.5 7,4.75" fill="#6ba62b" />
      {/* Left dirt side */}
      <polygon points="2,7.5 12,13 12,22 2,16.5" fill="#694f37" />
      {/* Right dirt side */}
      <polygon points="12,13 22,7.5 22,16.5 12,22" fill="#543d2b" />
      {/* Grass overhang drips */}
      <polygon points="2,7.5 12,13 12,15 9,13.5 9,15 6,13.5 6,15.5 2,13.5" fill="#588527" />
      <polygon points="12,13 22,7.5 22,13.5 18,15.5 18,13.5 15,15 15,13.5 12,15" fill="#4a7320" />
      {/* Soil flecks */}
      <rect x="5" y="17" width="2" height="1.5" fill="#846549" transform="skewY(27)" />
      <rect x="15" y="11" width="2" height="1.5" fill="#433021" transform="skewY(-27)" />
    </svg>
  );
}

export function DiscordIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export function TwitterIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function TikTokIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.87 2.89 2.89 0 0 1-2.89-2.87 2.89 2.89 0 0 1 2.89-2.88c.37 0 .72.07 1.04.19V9.45c-.34-.05-.69-.08-1.04-.08A6.34 6.34 0 0 0 3.15 15.7a6.34 6.34 0 0 0 6.34 6.34c3.5 0 6.34-2.84 6.34-6.34V8.76a8.28 8.28 0 0 0 4.76 1.49V6.78a4.86 4.86 0 0 1-1-.09z" />
    </svg>
  );
}

export function InstagramIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export function RedditIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.703zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.688-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  );
}

export function PlatformIcon({ platform, size = 16, className = '' }: PlatformIconProps) {
  switch (platform) {
    case 'xbox_mcpe':
      return <XboxIcon size={size} className={className} />;
    case 'minecraft':
      return <MinecraftIcon size={size} className={className} />;
    case 'discord':
      return <DiscordIcon size={size} className={className} />;
    case 'twitter':
      return <TwitterIcon size={size} className={className} />;
    case 'tiktok':
      return <TikTokIcon size={size} className={className} />;
    case 'instagram':
      return <InstagramIcon size={size} className={className} />;
    case 'facebook':
      return <FacebookIcon size={size} className={className} />;
    case 'reddit':
      return <RedditIcon size={size} className={className} />;
    default:
      return <XboxIcon size={size} className={className} />;
  }
}

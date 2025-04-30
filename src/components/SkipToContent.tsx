import React from 'react';

interface SkipToContentProps {
  contentId?: string;
}

/**
 * A component that allows keyboard users to skip navigation and go directly to main content
 */
const SkipToContent: React.FC<SkipToContentProps> = ({ contentId = 'main-content' }) => {
  return (
    <a 
      href={`#${contentId}`}
      className="skip-to-content"
    >
      Skip to main content
    </a>
  );
};

export default SkipToContent;
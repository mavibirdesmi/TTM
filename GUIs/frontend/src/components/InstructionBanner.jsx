import React from 'react';
import './InstructionBanner.css';

function InstructionBanner({ instruction }) {
  return (
    <div className="instruction-banner">
      {instruction}
    </div>
  );
}

export default InstructionBanner;

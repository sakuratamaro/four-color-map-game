"use strict";

// ACK feedback is transient; restored ownership is asserted separately after reload.
function cosmeticItemLayoutPass(geometry, { requireFeedback = true } = {}) {
  return geometry.overflow === false && geometry.cardWidth > 0
    && geometry.cardWidth <= geometry.viewport && geometry.buttonWidth >= 44
    && geometry.buttonHeight >= 44 && (!requireFeedback || geometry.feedbackInside === true);
}

module.exports = { cosmeticItemLayoutPass };

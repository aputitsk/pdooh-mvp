import Image from "next/image";

import styles from "./PremiumBillboard.module.css";

type ArcLetterStyle = React.CSSProperties & {
  "--arc-letter-index": number;
};

const headline = "Build real-world finance onchain";

export default function ArcDemoAdvertisement() {
  return (
    <div className={styles.arcDemoCreative}>
      <Image
        src="/arc-logo.png"
        alt="Arc"
        width={1200}
        height={675}
        className={styles.arcDemoLogo}
      />
      <p className={styles.arcDemoKicker}>Arc L1 blockchain</p>
      <h2 className={styles.arcDemoHeadline}>
        {Array.from(headline).map((character, index) => (
          <span
            key={`${character}-${index}`}
            className={styles.arcDemoHeadlineLetter}
            style={{ "--arc-letter-index": index } as ArcLetterStyle}
          >
            {character === " " ? "\u00A0" : character}
          </span>
        ))}
      </h2>
    </div>
  );
}

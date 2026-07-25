import brandMark from '../assets/learnexa-mark.svg';

const LogoIcon = ({ size = 32, className = '', alt = 'LearnExa' }) => (
  <img
    src={brandMark}
    width={size}
    height={size}
    className={`learnexa-logo-icon ${className}`.trim()}
    alt={alt}
    draggable="false"
  />
);

export default LogoIcon;

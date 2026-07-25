import { FaUser } from 'react-icons/fa';
import './Avatar.css';

import { DEFAULT_AVATAR } from './avatarConfig';
const palettes = {
  background: {
    lagoon: ['#0a6d78', '#62d7cd'],
    sunrise: ['#f08a3c', '#ffd36e'],
    sky: ['#2f80ed', '#83d5ff'],
    mint: ['#2ca58d', '#b9f3d8'],
    berry: ['#8f4fd9', '#f2a6d7'],
    midnight: ['#16324f', '#496a8c']
  },
  skinTone: {
    porcelain: '#f9dcc8',
    peach: '#efbd98',
    golden: '#dca477',
    caramel: '#b97851',
    cocoa: '#875338',
    deep: '#5d3829'
  },
  hairColor: {
    espresso: '#2b1b19',
    chocolate: '#513127',
    auburn: '#7f392a',
    black: '#151820',
    honey: '#aa6d2d',
    teal: '#0c6570'
  },
  outfitColor: {
    teal: '#087c87',
    orange: '#f0933f',
    blue: '#2f80ed',
    coral: '#e96868',
    navy: '#173b5f',
    mint: '#2ca58d'
  }
};

const Avatar = ({ avatar, size = 'md', className = '', title = 'Profile avatar' }) => {
  const model = { ...DEFAULT_AVATAR, ...(avatar || {}) };
  const [bgOne, bgTwo] = palettes.background[model.background] || palettes.background.lagoon;
  const style = {
    '--avatar-bg-one': bgOne,
    '--avatar-bg-two': bgTwo,
    '--avatar-skin': palettes.skinTone[model.skinTone] || palettes.skinTone.golden,
    '--avatar-hair': palettes.hairColor[model.hairColor] || palettes.hairColor.espresso,
    '--avatar-outfit': palettes.outfitColor[model.outfitColor] || palettes.outfitColor.teal
  };

  // New accounts start with a neutral, non-gendered profile mark. The illustrated
  // character appears only after the user intentionally saves an avatar design.
  if (model.customized !== true) {
    return (
      <div
        className={`student-avatar avatar-neutral avatar-size-${size} ${className}`.trim()}
        style={style}
        role="img"
        aria-label={`${title} — not customized`}
      >
        <span className="avatar-neutral-ring" />
        <FaUser className="avatar-neutral-icon" />
        <span className="avatar-neutral-spark">✦</span>
      </div>
    );
  }

  return (
    <div
      className={`student-avatar avatar-size-${size} ${className}`.trim()}
      style={style}
      role="img"
      aria-label={title}
    >
      <span className="avatar-glow" />
      <span className="avatar-star avatar-star-one">✦</span>
      <span className="avatar-star avatar-star-two">✧</span>

      <div className={`avatar-hair-back hair-${model.hairStyle}`} />
      <div className="avatar-ear avatar-ear-left" />
      <div className="avatar-ear avatar-ear-right" />
      <div className="avatar-neck" />

      <div className="avatar-face">
        <span className="avatar-brow avatar-brow-left" />
        <span className="avatar-brow avatar-brow-right" />
        <span className="avatar-eye avatar-eye-left" />
        <span className="avatar-eye avatar-eye-right" />
        <span className="avatar-nose" />
        <span className={`avatar-mouth mouth-${model.expression}`} />
        <span className="avatar-cheek avatar-cheek-left" />
        <span className="avatar-cheek avatar-cheek-right" />
        {(model.accessory === 'glasses' || model.accessory === 'round-glasses') && (
          <span className={`avatar-glasses ${model.accessory}`}>
            <i /><b /><i />
          </span>
        )}
      </div>

      <div className={`avatar-hair-front hair-${model.hairStyle}`} />

      {model.accessory === 'cap' && <div className="avatar-cap"><span /></div>}
      {model.accessory === 'headphones' && (
        <div className="avatar-headphones"><span /><i /><i /></div>
      )}

      <div className={`avatar-outfit outfit-${model.outfit}`}>
        <span className="avatar-shirt-neck" />
        {model.outfit === 'hoodie' && <><i className="hood hood-left" /><i className="hood hood-right" /></>}
        {model.outfit === 'jacket' && <i className="jacket-zip" />}
        {model.outfit === 'uniform' && <><i className="uniform-collar left" /><i className="uniform-collar right" /></>}
      </div>
    </div>
  );
};

export default Avatar;

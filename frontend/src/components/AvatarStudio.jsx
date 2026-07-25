import { useState } from 'react';
import { Alert, Button, Modal, Spinner } from 'react-bootstrap';
import { FaCheck, FaMagic, FaRandom, FaSave } from 'react-icons/fa';
import api, { getApiErrorMessage } from '../api/client';
import Avatar from './Avatar';
import { DEFAULT_AVATAR } from './avatarConfig';

const OPTION_GROUPS = [
  { key: 'background', label: 'Backdrop', options: ['lagoon', 'sunrise', 'sky', 'mint', 'berry', 'midnight'] },
  { key: 'skinTone', label: 'Skin tone', options: ['porcelain', 'peach', 'golden', 'caramel', 'cocoa', 'deep'] },
  { key: 'hairStyle', label: 'Hair style', options: ['short', 'waves', 'curly', 'bun', 'hijab'] },
  { key: 'hairColor', label: 'Hair color', options: ['espresso', 'chocolate', 'auburn', 'black', 'honey', 'teal'] },
  { key: 'outfit', label: 'Outfit', options: ['hoodie', 'sweater', 'jacket', 'uniform'] },
  { key: 'outfitColor', label: 'Outfit color', options: ['teal', 'orange', 'blue', 'coral', 'navy', 'mint'] },
  { key: 'accessory', label: 'Accessory', options: ['none', 'glasses', 'round-glasses', 'cap', 'headphones'] },
  { key: 'expression', label: 'Expression', options: ['smile', 'happy', 'calm'] }
];

const pretty = (value) => value.replace('-', ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const randomAvatar = () => OPTION_GROUPS.reduce((model, group) => ({
  ...model,
  [group.key]: group.options[Math.floor(Math.random() * group.options.length)]
}), { customized: true });

const AvatarStudio = ({ show, onHide, user, onSaved }) => {
  const [avatar, setAvatar] = useState({ ...DEFAULT_AVATAR, ...(user?.avatar || {}), customized: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const resetStudio = () => {
    setAvatar({ ...DEFAULT_AVATAR, ...(user?.avatar || {}), customized: true });
    setError('');
    setSaved(false);
  };

  const saveAvatar = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.patch('/profile', { avatar: { ...avatar, customized: true } });
      setSaved(true);
      onSaved?.(data.user);
      setTimeout(() => onHide(), 450);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Your avatar could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onEnter={resetStudio} onHide={saving ? undefined : onHide} centered size="xl" dialogClassName="avatar-studio-modal">
      <Modal.Header closeButton={!saving}>
        <div>
          <span className="avatar-studio-kicker"><FaMagic /> Personal identity</span>
          <Modal.Title>Design your LearnExa avatar</Modal.Title>
          <p>Build a look that represents you on your profile and the live leaderboard.</p>
        </div>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="avatar-studio-layout">
          <div className="avatar-preview-stage">
            <span className="preview-label">Live preview</span>
            <Avatar avatar={avatar} size="xl" title={`${user?.name || 'Student'} avatar preview`} />
            <strong>{user?.name || 'Your name'}</strong>
            <small>{user?.role || 'Student'} profile</small>
            <Button variant="light" className="avatar-random-button" onClick={() => setAvatar(randomAvatar())}>
              <FaRandom /> Surprise me
            </Button>
          </div>

          <div className="avatar-option-panel">
            {OPTION_GROUPS.map((group) => (
              <section className="avatar-option-group" key={group.key}>
                <h6>{group.label}</h6>
                <div className="avatar-option-grid">
                  {group.options.map((option) => (
                    <button
                      type="button"
                      key={option}
                      className={`avatar-option-chip ${avatar[group.key] === option ? 'selected' : ''}`}
                      onClick={() => setAvatar((current) => ({ ...current, customized: true, [group.key]: option }))}
                    >
                      <span className={`option-swatch option-${group.key}-${option}`} />
                      {pretty(option)}
                      {avatar[group.key] === option && <FaCheck />}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <span className={`avatar-save-status ${saved ? 'visible' : ''}`}><FaCheck /> Saved</span>
        <Button variant="outline-secondary" onClick={onHide} disabled={saving}>Cancel</Button>
        <Button onClick={saveAvatar} disabled={saving}>
          {saving ? <><Spinner animation="border" size="sm" className="me-2" /> Saving...</> : <><FaSave className="me-2" /> Save avatar</>}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AvatarStudio;

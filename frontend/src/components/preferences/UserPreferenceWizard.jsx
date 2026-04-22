import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  fetchUserPreferences,
  fetchUserPreferenceOptions,
  saveUserPreferences
} from '../../services/api/userPreferencesApi';
import './UserPreferenceWizard.css';

const NEW_ACCOUNT_ONBOARDING_KEY = 'smart-city-onboarding:new-account';

const FALLBACK_OPTIONS = {
  ageRanges: [
    { key: '13_17', label: '13-17' },
    { key: '18_24', label: '18-24' },
    { key: '25_34', label: '25-34' },
    { key: '35_49', label: '35-49' },
    { key: '50_plus', label: '50+' }
  ],
  genders: [
    { key: 'male', label: 'Male' },
    { key: 'female', label: 'Female' },
    { key: 'other', label: 'Other' }
  ],
  visitTimes: [
    { key: 'morning', label: 'Morning' },
    { key: 'noon', label: 'Noon' },
    { key: 'afternoon', label: 'Afternoon' },
    { key: 'evening', label: 'Evening' },
    { key: 'late_night', label: 'Late night' }
  ],
  interestsByAgeRange: {
    '13_17': [
      { key: 'street_food', label: 'Street food' },
      { key: 'bubble_tea', label: 'Bubble tea' },
      { key: 'instagram_spots', label: 'Instagram spots' },
      { key: 'arcades', label: 'Arcades & games' },
      { key: 'parks', label: 'Parks' },
      { key: 'cinema', label: 'Cinema' },
      { key: 'sports', label: 'Sports activities' }
    ],
    '18_24': [
      { key: 'nightlife', label: 'Nightlife' },
      { key: 'live_music', label: 'Live music' },
      { key: 'cafes', label: 'Cafes' },
      { key: 'street_food', label: 'Street food' },
      { key: 'adventure', label: 'Adventure' },
      { key: 'photography', label: 'Photography' },
      { key: 'fitness', label: 'Fitness' }
    ],
    '25_34': [
      { key: 'specialty_coffee', label: 'Specialty coffee' },
      { key: 'fine_dining', label: 'Fine dining' },
      { key: 'family_spots', label: 'Family spots' },
      { key: 'wellness', label: 'Wellness' },
      { key: 'networking', label: 'Networking places' },
      { key: 'cultural_sites', label: 'Cultural sites' },
      { key: 'weekend_getaways', label: 'Weekend getaways' }
    ],
    '35_49': [
      { key: 'family_friendly', label: 'Family friendly' },
      { key: 'local_cuisine', label: 'Local cuisine' },
      { key: 'heritage', label: 'Heritage places' },
      { key: 'wellness', label: 'Wellness' },
      { key: 'business_lunch', label: 'Business lunch' },
      { key: 'shopping', label: 'Shopping' },
      { key: 'nature_walks', label: 'Nature walks' }
    ],
    '50_plus': [
      { key: 'quiet_cafes', label: 'Quiet cafes' },
      { key: 'traditional_food', label: 'Traditional food' },
      { key: 'scenic_walks', label: 'Scenic walks' },
      { key: 'spiritual_sites', label: 'Spiritual sites' },
      { key: 'cultural_sites', label: 'Cultural sites' },
      { key: 'health_friendly', label: 'Health-friendly places' },
      { key: 'gardens', label: 'Gardens' }
    ]
  }
};

function normalizeOptionGroups(rawOptions) {
  if (!rawOptions || typeof rawOptions !== 'object') {
    return FALLBACK_OPTIONS;
  }

  const ageRanges = Array.isArray(rawOptions.ageRanges) && rawOptions.ageRanges.length
    ? rawOptions.ageRanges
    : FALLBACK_OPTIONS.ageRanges;

  const genders = Array.isArray(rawOptions.genders) && rawOptions.genders.length
    ? rawOptions.genders
    : FALLBACK_OPTIONS.genders;

  const visitTimes = Array.isArray(rawOptions.visitTimes) && rawOptions.visitTimes.length
    ? rawOptions.visitTimes
    : FALLBACK_OPTIONS.visitTimes;

  const interestsByAgeRange =
    rawOptions.interestsByAgeRange && typeof rawOptions.interestsByAgeRange === 'object'
      ? rawOptions.interestsByAgeRange
      : FALLBACK_OPTIONS.interestsByAgeRange;

  return {
    ageRanges,
    genders,
    visitTimes,
    interestsByAgeRange
  };
}

function normalizeSelectionList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))];
}

function buildInitialForm(preference, options) {
  const validAgeKeys = new Set(options.ageRanges.map((item) => item.key));
  const validGenderKeys = new Set(options.genders.map((item) => item.key));
  const validTimeKeys = new Set(options.visitTimes.map((item) => item.key));

  const ageRangeKey = validAgeKeys.has(preference?.ageRangeKey)
    ? preference.ageRangeKey
    : options.ageRanges[0]?.key || '';

  const preferredGender = validGenderKeys.has(preference?.preferredGender)
    ? preference.preferredGender
    : options.genders[0]?.key || '';

  const preferredTimes = normalizeSelectionList(preference?.preferredTimes)
    .filter((item) => validTimeKeys.has(item));

  const allowedInterests = new Set(
    (options.interestsByAgeRange[ageRangeKey] || []).map((item) => item.key)
  );

  const interests = normalizeSelectionList(preference?.interests)
    .filter((item) => allowedInterests.has(item));

  return {
    ageRangeKey,
    preferredGender,
    preferredTimes,
    interests
  };
}

export default function UserPreferenceWizard({
  isOpen,
  onClose,
  onSaved,
  initialPreference,
  currentCoordinates,
  title = 'Tell us what fits you'
}) {
  const { language } = useLanguage();
  const [step, setStep] = useState(1);
  const [options, setOptions] = useState(FALLBACK_OPTIONS);
  const [form, setForm] = useState(() => buildInitialForm(initialPreference, FALLBACK_OPTIONS));
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let active = true;

    const hydrate = async () => {
      setLoadingOptions(true);
      setError('');
      setStep(1);

      let nextOptions = FALLBACK_OPTIONS;
      let nextPreference = initialPreference || null;

      try {
        const [optionsResult, preferenceResult] = await Promise.allSettled([
          fetchUserPreferenceOptions(),
          fetchUserPreferences()
        ]);

        if (optionsResult.status === 'fulfilled' && active) {
          nextOptions = normalizeOptionGroups(optionsResult.value);
        }

        if (preferenceResult.status === 'fulfilled' && active) {
          nextPreference = preferenceResult.value?.preference || nextPreference;
        }
      } catch {
        nextOptions = FALLBACK_OPTIONS;
      } finally {
        if (active) {
          const normalizedOptions = normalizeOptionGroups(nextOptions);
          setOptions(normalizedOptions);
          setForm(buildInitialForm(nextPreference, normalizedOptions));
          setLoadingOptions(false);
        }
      }
    };

    hydrate();

    return () => {
      active = false;
    };
  }, [isOpen, initialPreference]);

  const availableInterests = useMemo(
    () => options.interestsByAgeRange[form.ageRangeKey] || [],
    [options.interestsByAgeRange, form.ageRangeKey]
  );

  const copy = useMemo(
    () =>
      language === 'vi'
        ? {
            title,
            stepLabel: (currentStep) => `BƯỚC ${currentStep} / 2`,
            loading: 'Đang tải tùy chọn...',
            ageRange: 'Độ tuổi phù hợp',
            gender: 'Giới tính',
            visitTimes: 'Thời gian bạn thường ra ngoài',
            interests: 'Sở thích',
            closeLabel: 'Đóng biểu mẫu sở thích',
            next: 'Tiếp theo',
            back: 'Quay lại',
            cancel: 'Hủy',
            save: 'Lưu sở thích',
            saving: 'Đang lưu...',
            stepOneError: 'Vui lòng chọn độ tuổi, giới tính và ít nhất một khung giờ.',
            stepTwoError: 'Vui lòng chọn ít nhất một sở thích.',
            saveError: 'Hiện chưa thể lưu sở thích. Vui lòng thử lại.'
          }
        : {
            title,
            stepLabel: (currentStep) => `STEP ${currentStep} OF 2`,
            loading: 'Loading options...',
            ageRange: 'Suitable age range',
            gender: 'Gender',
            visitTimes: 'Time you usually go out',
            interests: 'Interests',
            closeLabel: 'Close preference form',
            next: 'Next',
            back: 'Back',
            cancel: 'Cancel',
            save: 'Save preferences',
            saving: 'Saving...',
            stepOneError: 'Please select age range, gender, and at least one preferred time.',
            stepTwoError: 'Please choose at least one interest.',
            saveError: 'Unable to save preferences right now.'
          },
    [language, title]
  );

  if (!isOpen) {
    return null;
  }

  const stepOneValid = Boolean(form.ageRangeKey) && Boolean(form.preferredGender) && form.preferredTimes.length > 0;
  const stepTwoValid = form.interests.length > 0;

  const toggleFromList = (key, fieldName) => {
    setForm((prev) => {
      const nextList = prev[fieldName].includes(key)
        ? prev[fieldName].filter((item) => item !== key)
        : [...prev[fieldName], key];

      return {
        ...prev,
        [fieldName]: nextList
      };
    });
  };

  const handleAgeRangeChange = (nextAgeRangeKey) => {
    setForm((prev) => {
      const allowedInterests = new Set(
        (options.interestsByAgeRange[nextAgeRangeKey] || []).map((item) => item.key)
      );

      return {
        ...prev,
        ageRangeKey: nextAgeRangeKey,
        interests: prev.interests.filter((item) => allowedInterests.has(item))
      };
    });
  };

  const handleNext = () => {
    if (!stepOneValid) {
      setError(copy.stepOneError);
      return;
    }

    setError('');
    setStep(2);
  };

  const handleSave = async () => {
    if (!stepTwoValid) {
      setError(copy.stepTwoError);
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        ageRangeKey: form.ageRangeKey,
        preferredGender: form.preferredGender,
        preferredTimes: form.preferredTimes,
        interests: form.interests
      };

      const latitude = Number(currentCoordinates?.latitude);
      const longitude = Number(currentCoordinates?.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        payload.latitude = latitude;
        payload.longitude = longitude;
      }

      const response = await saveUserPreferences(payload);
      try {
        const rawPendingAccount = window.localStorage.getItem(NEW_ACCOUNT_ONBOARDING_KEY);
        if (rawPendingAccount) {
          const parsedPendingAccount = JSON.parse(rawPendingAccount);
          window.localStorage.setItem(
            NEW_ACCOUNT_ONBOARDING_KEY,
            JSON.stringify({
              ...parsedPendingAccount,
              preferencesSaved: true,
              preferencesSavedAt: new Date().toISOString()
            })
          );
          window.dispatchEvent(new CustomEvent('smart-city-preferences-saved'));
        }
      } catch {
        // Ignore onboarding marker sync errors.
      }
      if (typeof onSaved === 'function') {
        onSaved(response?.preference || null);
      }
      if (typeof onClose === 'function') {
        onClose();
      }
    } catch (saveError) {
      setError(saveError?.response?.data?.message || saveError?.message || copy.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="preference-wizard-overlay" role="dialog" aria-modal="true">
      <div className="preference-wizard-modal">
        <div className="preference-wizard-header">
          <div>
            <h3>{copy.title}</h3>
            <p>{copy.stepLabel(step)}</p>
          </div>
          <button
            type="button"
            className="preference-wizard-close"
            onClick={onClose}
            aria-label={copy.closeLabel}
          >
            x
          </button>
        </div>

        {loadingOptions ? (
          <div className="preference-wizard-loading">{copy.loading}</div>
        ) : (
          <div className="preference-wizard-body">
            {step === 1 ? (
              <div className="preference-wizard-step">
                <label className="preference-wizard-field">
                  <span>{copy.ageRange}</span>
                  <select
                    value={form.ageRangeKey}
                    onChange={(event) => handleAgeRangeChange(event.target.value)}
                  >
                    {options.ageRanges.map((ageRange) => (
                      <option key={ageRange.key} value={ageRange.key}>
                        {ageRange.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="preference-wizard-field">
                  <span>{copy.gender}</span>
                  <select
                    value={form.preferredGender}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        preferredGender: event.target.value
                      }))
                    }
                  >
                    {options.genders.map((gender) => (
                      <option key={gender.key} value={gender.key}>
                        {gender.label}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset className="preference-wizard-fieldset">
                  <legend>{copy.visitTimes}</legend>
                  <div className="preference-wizard-chip-grid">
                    {options.visitTimes.map((timeOption) => {
                      const checked = form.preferredTimes.includes(timeOption.key);
                      return (
                        <label
                          key={timeOption.key}
                          className={`preference-wizard-chip ${checked ? 'is-selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFromList(timeOption.key, 'preferredTimes')}
                          />
                          <span>{timeOption.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            ) : (
              <div className="preference-wizard-step">
                <fieldset className="preference-wizard-fieldset">
                  <legend>{copy.interests}</legend>
                  <div className="preference-wizard-interest-grid">
                    {availableInterests.map((interest) => {
                      const checked = form.interests.includes(interest.key);
                      return (
                        <label
                          key={interest.key}
                          className={`preference-wizard-chip ${checked ? 'is-selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFromList(interest.key, 'interests')}
                          />
                          <span>{interest.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            )}

            {error ? <p className="preference-wizard-error">{error}</p> : null}

            <div className="preference-wizard-actions">
              {step === 2 ? (
                <button
                  type="button"
                  className="preference-wizard-secondary"
                  onClick={() => {
                    setStep(1);
                    setError('');
                  }}
                  disabled={saving}
                >
                  {copy.back}
                </button>
              ) : (
                <button
                  type="button"
                  className="preference-wizard-secondary"
                  onClick={onClose}
                  disabled={saving}
                >
                  {copy.cancel}
                </button>
              )}

              {step === 1 ? (
                <button
                  type="button"
                  className="preference-wizard-primary"
                  onClick={handleNext}
                  disabled={!stepOneValid || saving}
                >
                  {copy.next}
                </button>
              ) : (
                <button
                  type="button"
                  className="preference-wizard-primary"
                  onClick={handleSave}
                  disabled={!stepTwoValid || saving}
                >
                  {saving ? copy.saving : copy.save}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

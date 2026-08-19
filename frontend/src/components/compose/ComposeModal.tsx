import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Send, Clock, Users, Zap } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { FileUpload } from '../ui/FileUpload';
import { useSenders } from '../../hooks/useEmails';
import api from '../../api/client';
import type { ScheduleEmailPayload } from '../../types';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ComposeModal({ isOpen, onClose, onSuccess }: ComposeModalProps) {
  const { senders, isLoading: sendersLoading } = useSenders();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [startTime, setStartTime] = useState('');
  const [delayBetween, setDelayBetween] = useState(5);
  const [maxPerHour, setMaxPerHour] = useState(50);
  const [recipients, setRecipients] = useState<string[]>([]);

  // Set default sender when senders load
  React.useEffect(() => {
    if (senders.length > 0 && !senderEmail) {
      setSenderEmail(senders[0].email);
    }
  }, [senders, senderEmail]);

  // Set default start time to 5 minutes from now
  React.useEffect(() => {
    if (!startTime) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 5);
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
      setStartTime(local.toISOString().slice(0, 16));
    }
  }, [startTime]);

  const handleFileContent = (content: string) => {
    if (!content) {
      setRecipients([]);
      return;
    }
    // Extract emails from content
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = content.match(emailRegex) || [];
    const unique = [...new Set(matches.map((e) => e.toLowerCase()))];
    setRecipients(unique);
  };

  const isValid = useMemo(
    () => subject.trim() && body.trim() && senderEmail && startTime && recipients.length > 0,
    [subject, body, senderEmail, startTime, recipients]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      const payload: ScheduleEmailPayload = {
        subject: subject.trim(),
        body: body.trim(),
        recipients,
        senderEmail,
        startTime: new Date(startTime).toISOString(),
        delayBetweenEmails: delayBetween * 1000, // Convert seconds to ms
        maxPerHour,
      };

      const response = await api.post('/emails/schedule', payload);

      toast.success(`Scheduled ${response.data.count} email(s) successfully!`, {
        icon: '🚀',
        duration: 4000,
      });

      // Reset form
      setSubject('');
      setBody('');
      setRecipients([]);
      setStartTime('');

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to schedule emails');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compose New Email" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Sender */}
        <Select
          label="Sender Account"
          value={senderEmail}
          onChange={(e) => setSenderEmail(e.target.value)}
          options={
            sendersLoading
              ? [{ value: '', label: 'Loading senders...' }]
              : senders.map((s) => ({ value: s.email, label: `${s.name} (${s.email})` }))
          }
        />

        {/* Subject */}
        <Input
          label="Subject"
          placeholder="Enter email subject..."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />

        {/* Body */}
        <Textarea
          label="Body"
          placeholder="Enter email body (HTML supported)..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          required
        />

        {/* File Upload */}
        <div>
          <FileUpload onFileContent={handleFileContent} />
          {recipients.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-400" />
              <span className="text-sm text-primary-300 font-medium">
                {recipients.length} email address{recipients.length !== 1 ? 'es' : ''} detected
              </span>
            </div>
          )}
        </div>

        {/* Schedule Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-dark-800/30 rounded-lg border border-dark-700/30">
          <div className="sm:col-span-3 flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-primary-400" />
            <span className="text-sm font-medium text-dark-200">Schedule Settings</span>
          </div>

          <Input
            label="Start Time"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />

          <Input
            label="Delay Between Emails (sec)"
            type="number"
            min={1}
            max={300}
            value={delayBetween}
            onChange={(e) => setDelayBetween(Number(e.target.value))}
            helperText="Min delay between sends"
          />

          <Input
            label="Max Emails Per Hour"
            type="number"
            min={1}
            max={1000}
            value={maxPerHour}
            onChange={(e) => setMaxPerHour(Number(e.target.value))}
            helperText="Rate limit per sender"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-dark-700/50">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            isLoading={isSubmitting}
            disabled={!isValid}
            leftIcon={<Send className="w-4 h-4" />}
          >
            Schedule {recipients.length > 0 ? `${recipients.length} Email${recipients.length !== 1 ? 's' : ''}` : 'Emails'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

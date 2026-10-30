import { useEffect, useState } from "react";
import {
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { Modal } from "../../components/modal/modal.jsx";
import { Btn, Status } from "../../components/ui/ui.jsx";
import { request, useAction } from "../../lib/core.js";
import { t, useLocale } from "../../i18n/index.js";
export default function BoardSharing({ base, sync, onClose }) {
  useLocale();
  const action = useAction(),
    [current, setCurrent] = useState(null),
    [enabled, setEnabled] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    request(`${base}sharing/`, "GET", undefined, controller.signal)
      .then((data) => {
        setCurrent(data);
        setEnabled(data.enabled);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [base]);
  async function save(rotate = false) {
    setMessage("");
    await action.run(async (signal) => {
      try {
        await sync.drain();
        const data = await request(
          `${base}sharing/`,
          "POST",
          { enabled, rotate },
          signal,
        );
        await sync.replace(data);
        setCurrent(data);
        setEnabled(data.enabled);
        setMessage(t("Sharing settings saved."));
      } finally {
        sync.resume();
      }
    });
  }
  const link = current?.path ? `${location.origin}${current.path}` : "";
  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      isDismissable={!action.pending}
      isKeyboardDismissDisabled={action.pending}
      hideCloseButton={action.pending}
      classNames={{ base: "glass dialog" }}
    >
      <ModalContent>
        <ModalHeader>{t("Lesson sharing")}</ModalHeader>
        <ModalBody>
          <p>
            {t(
              "Class members can always view this lesson. Public access is optional and view only.",
            )}
          </p>
          {current ? (
            <>
              <label className="wb-sharing-option">
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={action.pending}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <span>
                  <strong>
                    {t("Allow anyone with the link to watch live")}
                  </strong>
                  <small>
                    {t(
                      "No account required. The board and its PDF documents become visible to anyone with this link.",
                    )}
                  </small>
                </span>
              </label>
              {current.enabled && (
                <div className="wb-sharing-link">
                  <label>
                    {t("Public lesson link")}
                    <input
                      readOnly
                      value={link}
                      onFocus={(e) => e.target.select()}
                    />
                  </label>
                  <Btn
                    onClick={() =>
                      action.run(async () => {
                        await navigator.clipboard.writeText(link);
                        setMessage(t("Public lesson link copied."));
                      })
                    }
                    isDisabled={action.pending}
                  >
                    {t("Copy public link")}
                  </Btn>
                  <Btn
                    onClick={() => save(true)}
                    isDisabled={action.pending || !enabled}
                  >
                    {t("Create a new public link")}
                  </Btn>
                  <small>
                    {t(
                      "Changing the link makes the previous link stop working.",
                    )}
                  </small>
                </div>
              )}
              <p className="wb-sharing-note">
                {t(
                  "Turning sharing off blocks new access immediately. Connected guests are disconnected on the next update or when their short access ticket expires.",
                )}
              </p>
            </>
          ) : (
            !error && <p role="status">{t("Loading sharing settings…")}</p>
          )}
          <Status error={error || action.error} />
          {message && <p role="status">{message}</p>}
        </ModalBody>
        <ModalFooter>
          <Btn onClick={onClose} isDisabled={action.pending}>
            {t("Close")}
          </Btn>
          <Btn
            primary
            onClick={() => save()}
            isLoading={action.pending}
            isDisabled={!current || action.pending}
          >
            {t("Save sharing settings")}
          </Btn>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

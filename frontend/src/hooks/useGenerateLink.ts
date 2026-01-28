import { generateLink } from "@/services/mutation/generate-link";
import { useMutation } from "@tanstack/react-query";

export const useGenerateLinkApi = () => {
  return useMutation({
    mutationFn: generateLink,
  });
};

import { useEffect } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import {
  createSubmission,
  fetchSubmissions,
  subscribeToSubmissions,
} from '../services/submissions'
import type { Submission, SubmissionInput } from '../types'

const SUBMISSIONS_QUERY_KEY = ['submissions']

export function useSubmissions() {
  const queryClient = useQueryClient()
  const query = useQuery<Submission[]>({
    queryKey: SUBMISSIONS_QUERY_KEY,
    queryFn: fetchSubmissions,
    initialData: [],
  })

  useEffect(() => {
    const unsubscribe = subscribeToSubmissions((entries) => {
      queryClient.setQueryData(SUBMISSIONS_QUERY_KEY, sortByTimestamp(entries))
    })
    return unsubscribe
  }, [queryClient])

  return query
}

export function useSubmitSubmission(): UseMutationResult<Submission, Error, SubmissionInput> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createSubmission,
    onSuccess: (submission) => {
      queryClient.setQueryData<Submission[]>(SUBMISSIONS_QUERY_KEY, (current = []) =>
        sortByTimestamp([...current, submission]),
      )
    },
  })
}

function sortByTimestamp(submissions: Submission[]): Submission[] {
  return [...submissions].sort((a, b) => a.timestamp - b.timestamp)
}

import { useBLEStore } from '../store/bleStore'

export const useBLE = () => {
  const store = useBLEStore()
  return store
}

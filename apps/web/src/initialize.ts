import type { GQLClientInterface } from '~/contexts'

import { useCallback } from 'react'

import {
  getDefaultsRequest,
  getInterfacesRequest,
  getModeRequest,
  useCreateConfigMutation,
  useCreateDNSMutation,
  useCreateGroupMutation,
  useCreateRoutingMutation,
  useSelectConfigMutation,
  useSelectDNSMutation,
  useSelectRoutingMutation,
  useSetJsonStorageMutation,
} from '~/apis'
import {
  DEFAULT_CONFIG_NAME,
  DEFAULT_CONFIG_WITH_LAN_INTERFACEs,
  DEFAULT_DNS,
  DEFAULT_DNS_NAME,
  DEFAULT_GROUP_NAME,
  DEFAULT_GROUP_POLICY,
  DEFAULT_ROUTING,
  DEFAULT_ROUTING_NAME,
  MODE,
} from '~/constants'
import { useGQLQueryClient } from '~/contexts'
import { isMockMode, MOCK_DEFAULT_IDS } from '~/mocks'
import { defaultResourcesAtom, modeAtom } from '~/store'
import { routerMode } from '~/utils/router-mode'

interface DefaultResource {
  id: string
  name: string
  selected?: boolean
}

// Reuse an existing default resource with the default name instead of creating
// a duplicate. The wizard can be interrupted after a resource was created but
// before its default ID was recorded; retrying must not create a second record
// (which would either collide on the unique group name or leave an orphan DNS).
async function findDefaultResource(
  gqlClient: GQLClientInterface,
  root: 'configs' | 'routings' | 'dnss' | 'groups',
  name: string,
  selectable: boolean,
): Promise<string | undefined> {
  const fields = selectable ? 'id name selected' : 'id name'
  const data = await gqlClient.request<Record<string, DefaultResource[]>>(
    `query ExistingDefault { ${root} { ${fields} } }`,
  )
  const matched = (data[root] ?? []).filter((item) => item.name === name)
  if (matched.length === 0) return undefined
  return (matched.find((item) => item.selected) ?? matched[0]).id
}

export function useInitialize() {
  const createConfigMutation = useCreateConfigMutation()
  const selectConfigMutation = useSelectConfigMutation()
  const createRoutingMutation = useCreateRoutingMutation()
  const selectRoutingMutation = useSelectRoutingMutation()
  const createDNSMutation = useCreateDNSMutation()
  const selectDNSMutation = useSelectDNSMutation()
  const createGroupMutation = useCreateGroupMutation()
  const setJsonStorageMutation = useSetJsonStorageMutation()
  const gqlClient = useGQLQueryClient()
  const getInterfaces = getInterfacesRequest(gqlClient)
  const getMode = getModeRequest(gqlClient)
  const getDefaults = getDefaultsRequest(gqlClient)

  return useCallback(async () => {
    // In mock mode, use mock default IDs directly
    if (isMockMode()) {
      modeAtom.set(MODE.rule)
      defaultResourcesAtom.set(MOCK_DEFAULT_IDS)
      return
    }

    const [defaults, mode] = await Promise.all([getDefaults(), getMode()])
    const { defaultConfigID, defaultRoutingID, defaultDNSID, defaultGroupID } = defaults

    if (!defaultConfigID) {
      let id = await findDefaultResource(gqlClient, 'configs', DEFAULT_CONFIG_NAME, true)
      if (!id) {
        const lanInterfaces = (await getInterfaces()).general.interfaces
          .filter(({ flag }) => !!flag.default)
          .map(({ name }) => name)
        const {
          createConfig: { id: createdId },
        } = await createConfigMutation.mutateAsync({
          name: DEFAULT_CONFIG_NAME,
          global: DEFAULT_CONFIG_WITH_LAN_INTERFACEs(lanInterfaces),
        })
        id = createdId
      }

      await selectConfigMutation.mutateAsync({ id })
      await setJsonStorageMutation.mutateAsync({ defaultConfigID: id })
      defaults.defaultConfigID = id
    }

    if (!defaultRoutingID) {
      let id = await findDefaultResource(gqlClient, 'routings', DEFAULT_ROUTING_NAME, true)
      if (!id) {
        const {
          createRouting: { id: createdId },
        } = await createRoutingMutation.mutateAsync({ name: DEFAULT_ROUTING_NAME, routing: DEFAULT_ROUTING })
        id = createdId
      }

      await selectRoutingMutation.mutateAsync({ id })
      await setJsonStorageMutation.mutateAsync({ defaultRoutingID: id })
      defaults.defaultRoutingID = id
    }

    if (!defaultDNSID) {
      let id = await findDefaultResource(gqlClient, 'dnss', DEFAULT_DNS_NAME, true)
      if (!id) {
        const {
          createDns: { id: createdId },
        } = await createDNSMutation.mutateAsync({ name: DEFAULT_DNS_NAME, dns: DEFAULT_DNS })
        id = createdId
      }

      await selectDNSMutation.mutateAsync({ id })
      await setJsonStorageMutation.mutateAsync({ defaultDNSID: id })
      defaults.defaultDNSID = id
    }

    if (!defaultGroupID) {
      let id = await findDefaultResource(gqlClient, 'groups', DEFAULT_GROUP_NAME, false)
      if (!id) {
        const {
          createGroup: { id: createdId },
        } = await createGroupMutation.mutateAsync({
          name: DEFAULT_GROUP_NAME,
          policy: DEFAULT_GROUP_POLICY,
          policyParams: [],
        })
        id = createdId
      }
      await setJsonStorageMutation.mutateAsync({ defaultGroupID: id })
      defaults.defaultGroupID = id
    }

    // Only a fresh installation sets the initial mode. The service split
    // preset is not injected on startup; add it manually from the group
    // panel ("常用分流"). Upgrades retain every current choice.
    if (routerMode && !mode) {
      await setJsonStorageMutation.mutateAsync({ mode: MODE.rule })
      modeAtom.set(MODE.rule)
    } else if (!mode) {
      await setJsonStorageMutation.mutateAsync({ mode: MODE.simple })
      modeAtom.set(MODE.simple)
    } else {
      modeAtom.set(mode as MODE)
    }

    defaultResourcesAtom.set(defaults)
  }, [
    createConfigMutation,
    createDNSMutation,
    createGroupMutation,
    createRoutingMutation,
    getDefaults,
    getInterfaces,
    getMode,
    selectConfigMutation,
    selectDNSMutation,
    selectRoutingMutation,
    setJsonStorageMutation,
  ])
}

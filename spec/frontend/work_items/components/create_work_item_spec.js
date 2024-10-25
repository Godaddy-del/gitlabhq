import Vue, { nextTick } from 'vue';
import VueApollo from 'vue-apollo';
import { GlAlert, GlFormSelect } from '@gitlab/ui';
import { shallowMount } from '@vue/test-utils';
import namespaceWorkItemTypesQueryResponse from 'test_fixtures/graphql/work_items/namespace_work_item_types.query.graphql.json';
import { useLocalStorageSpy } from 'helpers/local_storage_helper';
import createMockApollo from 'helpers/mock_apollo_helper';
import waitForPromises from 'helpers/wait_for_promises';
import CreateWorkItem from '~/work_items/components/create_work_item.vue';
import WorkItemTitle from '~/work_items/components/work_item_title.vue';
import WorkItemDescription from '~/work_items/components/work_item_description.vue';
import WorkItemAssignees from '~/work_items/components/work_item_assignees.vue';
import WorkItemLabels from '~/work_items/components/work_item_labels.vue';
import WorkItemCrmContacts from '~/work_items/components/work_item_crm_contacts.vue';
import WorkItemProjectsListbox from '~/work_items/components/work_item_links/work_item_projects_listbox.vue';
import {
  WORK_ITEM_TYPE_ENUM_EPIC,
  WORK_ITEM_TYPE_ENUM_ISSUE,
  WORK_ITEMS_TYPE_MAP,
} from '~/work_items/constants';
import { setNewWorkItemCache } from '~/work_items/graphql/cache_utils';
import namespaceWorkItemTypesQuery from '~/work_items/graphql/namespace_work_item_types.query.graphql';
import createWorkItemMutation from '~/work_items/graphql/create_work_item.mutation.graphql';
import workItemByIidQuery from '~/work_items/graphql/work_item_by_iid.query.graphql';
import { resolvers } from '~/graphql_shared/issuable_client';
import { createWorkItemMutationResponse, createWorkItemQueryResponse } from '../mock_data';

jest.mock('~/work_items/graphql/cache_utils', () => ({
  setNewWorkItemCache: jest.fn(),
}));

const workItemEpicTypes =
  namespaceWorkItemTypesQueryResponse.data.workspace.workItemTypes.nodes.find(
    ({ name }) => name === 'Epic',
  );

const namespaceSingleWorkItemTypeQueryResponse = (workItemTypeName = WORK_ITEM_TYPE_ENUM_EPIC) => {
  const workItemTypes = namespaceWorkItemTypesQueryResponse.data.workspace.workItemTypes.nodes.find(
    ({ name }) => name.toLowerCase() === workItemTypeName.toLowerCase(),
  );

  return {
    data: {
      workspace: {
        ...namespaceWorkItemTypesQueryResponse.data.workspace,
        workItemTypes: {
          nodes: [workItemTypes],
        },
      },
    },
  };
};

Vue.use(VueApollo);

describe('Create work item component', () => {
  /** @type {import('@vue/test-utils').Wrapper} */
  let wrapper;
  let mockApollo;
  useLocalStorageSpy();

  const workItemTypeEpicId = workItemEpicTypes.id;

  const createWorkItemSuccessHandler = jest.fn().mockResolvedValue(createWorkItemMutationResponse);
  const errorHandler = jest.fn().mockRejectedValue('Houston, we have a problem');

  const workItemQuerySuccessHandler = jest.fn().mockResolvedValue(createWorkItemQueryResponse);
  const namespaceWorkItemTypesHandler = jest
    .fn()
    .mockResolvedValue(namespaceWorkItemTypesQueryResponse);
  const findFormTitle = () => wrapper.find('h1');
  const findAlert = () => wrapper.findComponent(GlAlert);
  const findTitleInput = () => wrapper.findComponent(WorkItemTitle);
  const findDescriptionWidget = () => wrapper.findComponent(WorkItemDescription);
  const findAssigneesWidget = () => wrapper.findComponent(WorkItemAssignees);
  const findLabelsWidget = () => wrapper.findComponent(WorkItemLabels);
  const findCrmContactsWidget = () => wrapper.findComponent(WorkItemCrmContacts);
  const findProjectsSelector = () => wrapper.findComponent(WorkItemProjectsListbox);
  const findSelect = () => wrapper.findComponent(GlFormSelect);
  const findConfidentialCheckbox = () => wrapper.find('[data-testid="confidential-checkbox"]');
  const findRelatesToCheckbox = () => wrapper.find('[data-testid="relates-to-checkbox"]');
  const findCreateWorkItemView = () => wrapper.find('[data-testid="create-work-item-view"]');

  const findCreateButton = () => wrapper.find('[data-testid="create-button"]');
  const findCancelButton = () => wrapper.find('[data-testid="cancel-button"]');

  const createComponent = ({
    props = {},
    mutationHandler = createWorkItemSuccessHandler,
    singleWorkItemType = false,
    workItemTypeName = WORK_ITEM_TYPE_ENUM_EPIC,
  } = {}) => {
    mockApollo = createMockApollo(
      [
        [workItemByIidQuery, workItemQuerySuccessHandler],
        [createWorkItemMutation, mutationHandler],
        [namespaceWorkItemTypesQuery, namespaceWorkItemTypesHandler],
      ],
      resolvers,
      { typePolicies: { Project: { merge: true } } },
    );

    const namespaceWorkItemTypeResponse = singleWorkItemType
      ? namespaceSingleWorkItemTypeQueryResponse(workItemTypeName)
      : namespaceWorkItemTypesQueryResponse;
    mockApollo.clients.defaultClient.cache.writeQuery({
      query: namespaceWorkItemTypesQuery,
      variables: { fullPath: 'full-path', name: workItemTypeName },
      data: namespaceWorkItemTypeResponse.data,
    });

    wrapper = shallowMount(CreateWorkItem, {
      apolloProvider: mockApollo,
      propsData: {
        workItemTypeName,
        ...props,
      },
      provide: {
        fullPath: 'full-path',
        hasIssuableHealthStatusFeature: false,
        hasIterationsFeature: true,
      },
    });
  };

  const initialiseComponentAndSelectWorkItem = async ({
    props = {},
    mutationHandler = createWorkItemSuccessHandler,
  } = {}) => {
    createComponent({ props, mutationHandler });

    await waitForPromises();

    findSelect().vm.$emit('input', workItemTypeEpicId);
    await waitForPromises();
  };

  const updateWorkItemTitle = async (title = 'Test title') => {
    findTitleInput().vm.$emit('updateDraft', title);
    await nextTick();
    await waitForPromises();
  };

  const submitCreateForm = async () => {
    wrapper.find('form').trigger('submit');
    await waitForPromises();
  };

  const mockCurrentUser = {
    id: 1,
    name: 'Administrator',
    username: 'root',
    avatar_url: 'avatar/url',
  };

  beforeEach(() => {
    gon.current_user_id = mockCurrentUser.id;
    gon.current_user_fullname = mockCurrentUser.name;
    gon.current_username = mockCurrentUser.username;
    gon.current_user_avatar_url = mockCurrentUser.avatar_url;
  });

  describe('Default', () => {
    beforeEach(async () => {
      await initialiseComponentAndSelectWorkItem();
    });

    it('does not render error by default', () => {
      expect(findTitleInput().props('isValid')).toBe(true);
      expect(findAlert().exists()).toBe(false);
    });

    it('emits event on Cancel button click', () => {
      findCancelButton().vm.$emit('click');
      expect(wrapper.emitted('cancel')).toEqual([[]]);
    });
  });

  describe('Cache clearing', () => {
    it('Default', async () => {
      await initialiseComponentAndSelectWorkItem();

      const AUTO_SAVE_KEY = `autosave/new-full-path-epic-draft`;

      findCancelButton().vm.$emit('click');

      await nextTick();
      expect(localStorage.removeItem).toHaveBeenCalledWith(AUTO_SAVE_KEY);
      expect(setNewWorkItemCache).toHaveBeenCalled();
    });

    const workItemTypes = Object.keys(WORK_ITEMS_TYPE_MAP);

    it.each(workItemTypes)(
      'Clears cache on cancel for workItemType: %s with the correct data',
      async (type) => {
        const typeName = WORK_ITEMS_TYPE_MAP[type].value;

        const expectedWorkItemTypeData =
          namespaceWorkItemTypesQueryResponse.data.workspace.workItemTypes.nodes.find(
            ({ name }) => name === typeName,
          );

        createComponent({ singleWorkItemType: true, workItemTypeName: typeName });
        await waitForPromises();

        findCancelButton().vm.$emit('click');

        await nextTick();

        expect(setNewWorkItemCache).toHaveBeenCalledWith(
          'full-path',
          expectedWorkItemTypeData.widgetDefinitions,
          expectedWorkItemTypeData.name,
          expectedWorkItemTypeData.id,
        );
      },
    );
  });

  describe('When there is no work item type', () => {
    beforeEach(() => {
      createComponent({ workItemTypeName: null });
      return waitForPromises();
    });

    it('shows the select dropdown with the valid work item types', () => {
      expect(findSelect().exists()).toBe(true);
    });

    it('does not render the work item view', () => {
      expect(findCreateWorkItemView().exists()).toBe(false);
    });
  });

  describe('project selector', () => {
    it.each([true, false])(
      'renders based on value of showProjectSelector prop',
      (showProjectSelector) => {
        createComponent({ props: { showProjectSelector } });

        expect(findProjectsSelector().exists()).toBe(showProjectSelector);
      },
    );
  });

  describe('Work item types dropdown', () => {
    it('displays a list of namespace work item types', async () => {
      createComponent();
      await waitForPromises();

      // +1 for the "None" option
      const expectedOptions =
        namespaceWorkItemTypesQueryResponse.data.workspace.workItemTypes.nodes.length + 1;
      expect(findSelect().attributes('options').split(',')).toHaveLength(expectedOptions);
    });

    it('hides the select field if there is only a single type', async () => {
      createComponent({
        singleWorkItemType: true,
      });
      await waitForPromises();

      expect(findSelect().exists()).toBe(false);
    });

    it('selects a work item type on click', async () => {
      createComponent();
      await waitForPromises();

      const mockId = 'Issue';
      findSelect().vm.$emit('input', mockId);
      await nextTick();

      expect(findSelect().attributes('value')).toBe(mockId);
    });

    it('hides title if set', async () => {
      createComponent({
        props: { hideFormTitle: true },
      });

      await waitForPromises();

      expect(findFormTitle().exists()).toBe(false);
    });

    it('filters work item type based on route parameter', async () => {
      createComponent({ singleWorkItemType: true });
      await waitForPromises();

      expect(findSelect().exists()).toBe(false);
      expect(findFormTitle().text()).toBe('New epic');
    });
  });

  describe('Create work item', () => {
    it('emits workItemCreated on successful mutation', async () => {
      await initialiseComponentAndSelectWorkItem();

      findTitleInput().vm.$emit('updateDraft', 'Test title');
      await waitForPromises();

      await submitCreateForm();

      expect(wrapper.emitted('workItemCreated')).toEqual([
        [createWorkItemMutationResponse.data.workItemCreate.workItem],
      ]);
    });

    it('emits workItemCreated for confidential work item', async () => {
      await initialiseComponentAndSelectWorkItem();

      findConfidentialCheckbox().vm.$emit('change', true);
      await updateWorkItemTitle();

      wrapper.find('form').trigger('submit');
      await waitForPromises();

      expect(createWorkItemSuccessHandler).toHaveBeenCalledWith({
        input: expect.objectContaining({
          title: 'Test title',
          confidential: true,
        }),
      });
    });

    it('creates work item with parent when parentId exists', async () => {
      const parentId = 'gid://gitlab/WorkItem/456';
      await initialiseComponentAndSelectWorkItem({ props: { parentId } });
      await updateWorkItemTitle();
      wrapper.find('form').trigger('submit');

      expect(createWorkItemSuccessHandler).toHaveBeenCalledWith({
        input: expect.objectContaining({
          hierarchyWidget: { parentId },
        }),
      });
    });

    it('creates work item within a specific namespace when project is selected', async () => {
      const fullPath = 'chosen/full/path';
      await initialiseComponentAndSelectWorkItem({ props: { showProjectSelector: true } });
      findProjectsSelector().vm.$emit('selectProject', fullPath);
      await updateWorkItemTitle();
      wrapper.find('form').trigger('submit');

      expect(createWorkItemSuccessHandler).toHaveBeenCalledWith({
        input: expect.objectContaining({
          namespacePath: fullPath,
        }),
      });
    });

    it('does not commit when title is empty', async () => {
      await initialiseComponentAndSelectWorkItem();

      await updateWorkItemTitle('');

      wrapper.find('form').trigger('submit');
      await waitForPromises();

      expect(findTitleInput().props('isValid')).toBe(false);
      expect(wrapper.emitted('workItemCreated')).toEqual(undefined);
    });

    it('updates work item title on update mutation', async () => {
      await initialiseComponentAndSelectWorkItem();

      await updateWorkItemTitle();

      expect(findTitleInput().props('title')).toBe('Test title');
    });

    it('when title input field has a text renders Create button when work item type is selected', async () => {
      await initialiseComponentAndSelectWorkItem();
      await updateWorkItemTitle();

      expect(findCreateButton().props('disabled')).toBe(false);
    });

    it('shows an alert when no project is selected', async () => {
      await initialiseComponentAndSelectWorkItem({ props: { showProjectSelector: true } });
      await updateWorkItemTitle();
      wrapper.find('form').trigger('submit');
      await nextTick();

      expect(findAlert().text()).toBe('Please select a project.');
      expect(createWorkItemSuccessHandler).not.toHaveBeenCalled();
    });

    it('shows an alert on mutation error', async () => {
      await initialiseComponentAndSelectWorkItem({ mutationHandler: errorHandler });

      await updateWorkItemTitle();

      await submitCreateForm();

      expect(findAlert().text()).toBe('Something went wrong when creating epic. Please try again.');
    });
  });

  describe('Create work item widgets for epic work item type', () => {
    describe('default', () => {
      beforeEach(async () => {
        createComponent({ singleWorkItemType: true });
        await waitForPromises();
      });

      it('renders the work item title widget', () => {
        expect(findTitleInput().exists()).toBe(true);
      });

      it('renders the work item description widget', () => {
        expect(findDescriptionWidget().exists()).toBe(true);
      });

      it('renders the work item assignees widget', () => {
        expect(findAssigneesWidget().exists()).toBe(true);
      });

      it('renders the work item labels widget', () => {
        expect(findLabelsWidget().exists()).toBe(true);
      });

      it('renders the work item CRM contacts widget', () => {
        expect(findCrmContactsWidget().exists()).toBe(true);
      });
    });

    it('uses the description prop as the initial description value when defined', async () => {
      const description = 'i am a description';
      createComponent({
        singleWorkItemType: true,
        props: { description },
      });
      await waitForPromises();

      expect(findDescriptionWidget().props('description')).toBe(description);
    });

    it('uses the title prop as the initial title value when defined', async () => {
      const title = 'i am a title';
      createComponent({ singleWorkItemType: true, props: { title } });
      await waitForPromises();

      expect(findTitleInput().props('title')).toBe(title);
    });
  });

  describe('Create work item widgets for Issue work item type', () => {
    describe('default', () => {
      beforeEach(async () => {
        createComponent({ singleWorkItemType: true, workItemTypeName: WORK_ITEM_TYPE_ENUM_ISSUE });
        await waitForPromises();
      });

      it('renders the work item title widget', () => {
        expect(findTitleInput().exists()).toBe(true);
      });

      it('renders the work item description widget', () => {
        expect(findDescriptionWidget().exists()).toBe(true);
      });

      it('renders the work item assignees widget', () => {
        expect(findAssigneesWidget().exists()).toBe(true);
      });

      it('renders the work item labels widget', () => {
        expect(findLabelsWidget().exists()).toBe(true);
      });
    });
  });

  describe('With related item', () => {
    const id = 'gid://gitlab/WorkItem/1';
    const type = 'Epic';
    const reference = 'gitlab-org#1';

    beforeEach(async () => {
      createComponent({
        singleWorkItemType: true,
        props: {
          relatedItem: {
            id,
            type,
            reference,
          },
        },
      });
      await waitForPromises();
    });

    it('renders a checkbox', () => {
      expect(findRelatesToCheckbox().exists()).toBe(true);
    });

    it('renders the correct text for the checkbox', () => {
      expect(findRelatesToCheckbox().text()).toContain(`Relates to ${type} ${reference}`);
    });

    it('includes the related item in the create work item request', async () => {
      await updateWorkItemTitle();
      await submitCreateForm();

      expect(createWorkItemSuccessHandler).toHaveBeenCalledWith({
        input: expect.objectContaining({
          linkedItemsWidget: {
            workItemsIds: [id],
          },
        }),
      });
    });

    it('does not include the related item in the create work item request if the checkbox is unchecked', async () => {
      await updateWorkItemTitle();
      findRelatesToCheckbox().vm.$emit('input', false);
      await submitCreateForm();

      expect(createWorkItemSuccessHandler).not.toHaveBeenCalledWith({
        input: expect.objectContaining({
          linkedItemsWidget: {
            workItemsIds: [id],
          },
        }),
      });
    });
  });
});
